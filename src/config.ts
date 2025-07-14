import * as fs from 'fs';
import * as path from 'path';
import { CalverReleaseOptions, CalverReleaseContext, Config, PluginDefinition } from './types';

/**
 * Get configuration from multiple sources (like semantic-release)
 * Priority: options > package.json > config files > defaults
 */
export async function getConfig(
  options: CalverReleaseOptions = {}, 
  context: Partial<CalverReleaseContext> = {}
): Promise<Config> {
  const cwd = context.cwd || process.cwd();
  
  // Default configuration
  const defaults: Config = {
    branches: ['main', 'master'],
    tagFormat: 'v-${version}',
    dryRun: false,
    debug: false,
    ci: true,
    repositoryUrl: '',
    autoUpdateMonth: false,
    plugins: [
      '@calver-release/commit-analyzer',
      '@calver-release/release-notes-generator', 
      '@calver-release/changelog',
      '@calver-release/npm',
      '@calver-release/git',
      '@calver-release/gitlab',
      '@calver-release/github'
    ]
  };
  
  // Load from package.json
  const packageJsonConfig = await loadPackageJsonConfig(cwd);
  
  // Load from config files
  const configFileConfig = await loadConfigFile(cwd);
  
  // Merge configurations
  const config: Config = {
    ...defaults,
    ...configFileConfig,
    ...packageJsonConfig,
    ...options
  };
  
  // Process environment variables
  config.dryRun = config.dryRun || process.env.DRY_RUN === 'true';
  config.debug = config.debug || process.env.DEBUG === 'true';
  config.ci = config.ci && (process.env.CI === 'true' || process.env.GITLAB_CI === 'true');
  
  // Validate configuration
  validateConfig(config);
  
  return config;
}

/**
 * Load configuration from package.json
 */
async function loadPackageJsonConfig(cwd: string): Promise<Partial<CalverReleaseOptions>> {
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return {};
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson['calver-release'] || packageJson.release || {};
  } catch (error) {
    return {};
  }
}

/**
 * Load configuration from config files
 */
async function loadConfigFile(cwd: string): Promise<Partial<CalverReleaseOptions>> {
  const configFiles = [
    '.calver-releaserc',
    '.calver-releaserc.json',
    '.calver-releaserc.js',
    'calver-release.config.js',
    'release.config.js'
  ];
  
  for (const configFile of configFiles) {
    const configPath = path.join(cwd, configFile);
    
    if (fs.existsSync(configPath)) {
      try {
        if (configFile.endsWith('.js')) {
          // JavaScript config file
          delete require.cache[require.resolve(configPath)];
          const config = require(configPath);
          return typeof config === 'function' ? config() : config;
        } else {
          // JSON config file
          const configContent = fs.readFileSync(configPath, 'utf8');
          return JSON.parse(configContent);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load config from ${configFile}: ${errorMessage}`);
      }
    }
  }
  
  return {};
}

/**
 * Validate configuration
 */
function validateConfig(config: Config): boolean {
  if (!Array.isArray(config.branches)) {
    throw new Error('Configuration "branches" must be an array');
  }
  
  if (!Array.isArray(config.plugins)) {
    throw new Error('Configuration "plugins" must be an array');
  }
  
  return true;
}

export { loadPackageJsonConfig, loadConfigFile, validateConfig };