import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Plugin, CalverReleaseContext, PluginFactory, PluginResult } from '../types';

/**
 * Built-in npm plugin - updates package.json versions and publishes to NPM
 */
const createNpmPlugin: PluginFactory = (options: any = {}): Plugin => {
  const {
    npmPublish = true,
    registry = 'https://registry.npmjs.org'
  } = options;

  return {
    verifyConditions: async (ctx: CalverReleaseContext): Promise<void> => {
      const { logger, options } = ctx;
      
      // Skip token check in dry-run mode or if publishing is disabled
      if (options?.dryRun || !npmPublish) {
        logger?.log(options?.dryRun ? 'Dry run mode - NPM token check skipped' : 'NPM publishing disabled');
        return;
      }
      
      // Check if NPM_TOKEN is available for real publishing
      if (!process.env.NPM_TOKEN && !process.env.NODE_AUTH_TOKEN) {
        throw new Error('NPM_TOKEN or NODE_AUTH_TOKEN environment variable is required for publishing');
      }
      
      logger?.log('NPM publishing enabled and token found');
    },

    prepare: async (ctx: CalverReleaseContext): Promise<void> => {
      const { logger, nextRelease } = ctx;
      
      logger?.log('Updating package.json versions...');
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        // Update version for each package
        for (const release of nextRelease.releases) {
          await updatePackageVersion(release.package.path, release.version);
        }
      } else if (nextRelease) {
        // Single package
        const packagePath = (nextRelease as any).package?.path || '.';
        await updatePackageVersion(packagePath, (nextRelease as any).version);
      }
    },

    publish: async (ctx: CalverReleaseContext): Promise<PluginResult[]> => {
      const { logger, nextRelease, options } = ctx;
      const results: PluginResult[] = [];
      
      // Skip publishing in dry-run mode or if disabled
      if (options?.dryRun || !npmPublish) {
        logger?.log(options?.dryRun ? 'Dry run mode - NPM publishing skipped' : 'NPM publishing disabled, skipping...');
        return results;
      }

      logger?.log('Publishing to NPM...');
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        // Publish each package
        for (const release of nextRelease.releases) {
          const result = await publishPackage(release.package.path, release.version, registry, logger);
          results.push(result);
        }
      } else if (nextRelease) {
        // Single package
        const packagePath = (nextRelease as any).package?.path || '.';
        const result = await publishPackage(packagePath, (nextRelease as any).version, registry, logger);
        results.push(result);
      }
      
      return results;
    }
  };
};

async function updatePackageVersion(packagePath: string, version: string): Promise<void> {
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = version;
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

async function publishPackage(packagePath: string, version: string, registry: string, logger: any): Promise<PluginResult> {
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Package.json not found at ${packageJsonPath}`);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name;
  
  try {
    // Set npm registry if custom
    if (registry !== 'https://registry.npmjs.org') {
      execSync(`npm config set registry ${registry}`, { cwd: packagePath });
    }
    
    // Build if needed
    if (packageJson.scripts && packageJson.scripts.build) {
      logger?.log(`Building package ${packageName}...`);
      execSync('npm run build', { cwd: packagePath, stdio: 'inherit' });
    }
    
    // Publish to npm
    logger?.log(`Publishing ${packageName}@${version} to NPM...`);
    execSync('npm publish --access public', { 
      cwd: packagePath, 
      stdio: 'inherit',
      env: {
        ...process.env,
        NPM_TOKEN: process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN
      }
    });
    
    const publishUrl = `https://www.npmjs.com/package/${packageName}/v/${version}`;
    logger?.success(`Published ${packageName}@${version} to NPM: ${publishUrl}`);
    
    return {
      type: 'npm',
      url: publishUrl,
      id: `${packageName}@${version}`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to publish ${packageName}@${version} to NPM: ${errorMessage}`);
  }
}

export default createNpmPlugin;