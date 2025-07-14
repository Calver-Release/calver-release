import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Import from JS file until converted
const {
  detectMonorepoConfig,
  discoverWorkspaces,
  getChangedPackages,
  analyzeCommits,
  generateCalVerVersion,
  generateReleaseNotes,
  updateChangelog,
  processPackageRelease
} = require('./release-core');

import { getConfig } from './config';
import { getPlugins } from './plugins';

import {
  CalverReleaseOptions,
  CalverReleaseContext,
  CalverReleaseResult,
  NextRelease,
  Logger,
  Config,
  PluginCollection,
  CommitAnalysis,
  Package,
  ReleaseResult
} from './types';

/**
 * CalVer Release - Semantic-release style automated CalVer releases
 * 
 * Usage similar to semantic-release:
 * 
 * import calverRelease from 'calver-release';
 * await calverRelease();
 * 
 * Or with options:
 * await calverRelease({
 *   branches: ['main', 'master'],
 *   dryRun: false,
 *   ci: true
 * });
 */

/**
 * Main calver-release function - semantic-release style
 * @param options - Configuration options
 * @param context - Context object (like semantic-release)
 * @returns Release result
 */
async function calverRelease(
  options: CalverReleaseOptions = {},
  context: Partial<CalverReleaseContext> = {}
): Promise<CalverReleaseResult> {
  const startTime = Date.now();
  
  // Get configuration (merge options with config files)
  const config: Config = await getConfig(options, context);
  
  // Initialize context
  const ctx: CalverReleaseContext = {
    ...context,
    cwd: context.cwd || process.cwd(),
    env: context.env || process.env as Record<string, string | undefined>,
    stdout: context.stdout || process.stdout,
    stderr: context.stderr || process.stderr,
    logger: context.logger || createLogger(config),
    options: config
  };

  ctx.logger!.log('Starting calver-release...');
  
  // Load and run plugins
  const plugins: PluginCollection = await getPlugins(config, ctx);
  
  try {
    
    // Step 1: Verify conditions
    ctx.logger!.log('Verify release conditions');
    await runPlugins(plugins.verifyConditions, ctx);
    
    // Step 2: Analyze commits and determine release
    ctx.logger!.log('Analyze commits');
    const analysis = await analyzeStep(ctx);
    
    if (!analysis.shouldRelease) {
      ctx.logger!.log('No release necessary');
      return { released: false };
    }
    
    // Step 3: Verify release
    ctx.logger!.log('Verify release');
    ctx.nextRelease = analysis.nextRelease;
    await runPlugins(plugins.verifyRelease, ctx);
    
    // Step 4: Generate notes
    ctx.logger!.log('Generate release notes');
    const notes = await runPlugins(plugins.generateNotes, ctx);
    ctx.nextRelease!.notes = notes.filter(n => n).join('\\n\\n');
    
    // Skip file modifications in dry-run mode
    if (config.dryRun) {
      ctx.logger!.log('Dry run complete');
      return {
        released: false,
        dryRun: true,
        nextRelease: ctx.nextRelease
      };
    }
    
    // Step 5: Prepare release
    ctx.logger!.log('Prepare release');
    await runPlugins(plugins.prepare, ctx);
    
    // Step 6: Publish release
    ctx.logger!.log('Publish release');
    const publishResult = await runPlugins(plugins.publish, ctx);
    
    // Step 7: Success actions
    ctx.logger!.log('Release successful');
    await runPlugins(plugins.success, ctx);
    
    const duration = Date.now() - startTime;
    ctx.logger!.log(`Released in ${duration}ms`);
    
    return {
      released: true,
      nextRelease: ctx.nextRelease,
      releases: publishResult.flat()
    };
    
  } catch (error) {
    // Step 8: Failure actions
    const errorMessage = error instanceof Error ? error.message : String(error);
    ctx.logger!.error('Release failed:', errorMessage);
    await runPlugins(plugins.fail || [], ctx, error as Error);
    throw error;
  }
}

/**
 * Analyze commits and determine if release is needed
 */
async function analyzeStep(ctx: CalverReleaseContext): Promise<{ shouldRelease: boolean; nextRelease?: NextRelease }> {
  const { options, logger } = ctx;
  
  // Detect monorepo configuration
  const monorepoConfig = detectMonorepoConfig();
  (ctx as any).monorepoConfig = monorepoConfig;
  
  // Discover packages
  const packages = discoverWorkspaces(monorepoConfig);
  ctx.packages = packages;
  
  // Get commits since last release
  const commits = getCommitsSinceLastRelease();
  
  if (!commits) {
    return { shouldRelease: false };
  }
  
  // For monorepo, get changed packages
  const packagesToRelease = getChangedPackages(packages, commits);
  
  if (packagesToRelease.length === 0) {
    return { shouldRelease: false };
  }
  
  // Analyze commits for each package
  const releases: ReleaseResult[] = [];
  
  for (const pkg of packagesToRelease) {
    const analysis = analyzeCommits(commits, pkg.path);
    
    if (analysis && analysis.shouldRelease) {
      const version = generateCalVerVersion(analysis.releaseType, pkg.path, options);
      const packageName = pkg.name === 'root' ? null : pkg.name;
      
      const releaseNotes = generateReleaseNotes(analysis, version, packageName);
      const tagName = packageName ? `v-${version}-${packageName}-release` : `v-${version}`;
      
      releases.push({
        package: pkg,
        analysis,
        version,
        packageName,
        releaseNotes,
        tagName,
        name: packageName || 'root'
      });
    }
  }
  
  if (releases.length === 0) {
    return { shouldRelease: false };
  }
  
  return {
    shouldRelease: true,
    nextRelease: releases.length === 1 ? releases[0] : {
      type: 'multi',
      releases,
      version: releases.map(r => `${r.name}@${r.version}`).join(', ')
    }
  };
}

/**
 * Get commits since last release
 */
function getCommitsSinceLastRelease(): string | null {
  let latestTag: string | null = null;
  try {
    latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch (error) {
    // No tags found
  }

  let commits: string;
  if (latestTag) {
    try {
      commits = execSync(`git log --oneline ${latestTag}..HEAD`, { encoding: 'utf8' }).trim();
    } catch (error) {
      commits = execSync('git log --oneline', { encoding: 'utf8' }).trim();
    }
  } else {
    commits = execSync('git log --oneline', { encoding: 'utf8' }).trim();
  }

  return commits || null;
}

/**
 * Run plugins in sequence
 */
async function runPlugins(plugins: any[], ctx: CalverReleaseContext, ...args: any[]): Promise<any[]> {
  const results: any[] = [];
  
  for (const plugin of plugins) {
    try {
      const result = await plugin(ctx, ...args);
      if (result !== undefined) {
        results.push(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.logger!.error(`Plugin failed: ${errorMessage}`);
      throw error;
    }
  }
  
  return results;
}

/**
 * Create default logger
 */
function createLogger(config: Config): Logger {
  const isVerbose = config.debug || config.verbose;
  
  return {
    log: (...args: any[]) => {
      if (isVerbose) console.log('📋', ...args);
    },
    error: (...args: any[]) => {
      console.error('❌', ...args);
    },
    success: (...args: any[]) => {
      console.log('✅', ...args);
    },
    info: (...args: any[]) => {
      console.log('ℹ️', ...args);
    }
  };
}

// Export main function as default (semantic-release style)
export default calverRelease;

// Also export named functions for advanced usage
export { calverRelease };
export { detectMonorepoConfig } from './release-core';
export { discoverWorkspaces } from './release-core';
export { getChangedPackages } from './release-core';
export { analyzeCommits } from './release-core';
export { generateCalVerVersion } from './release-core';
export { generateReleaseNotes } from './release-core';
export { updateChangelog } from './release-core';

// Export types for plugin development
export * from './types';