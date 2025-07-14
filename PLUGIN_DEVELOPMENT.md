# 🔌 Plugin Development Guide

This guide covers everything you need to know to develop custom plugins for CalVer Release.

## 📚 Table of Contents

- [Plugin Architecture](#plugin-architecture)
- [Plugin Lifecycle](#plugin-lifecycle)
- [TypeScript Support](#typescript-support)
- [Development Setup](#development-setup)
- [Plugin Examples](#plugin-examples)
- [Testing Plugins](#testing-plugins)
- [Publishing Plugins](#publishing-plugins)
- [Best Practices](#best-practices)

## 🏗️ Plugin Architecture

CalVer Release uses a **plugin-based architecture** similar to semantic-release, where plugins are organized around specific release lifecycle steps.

### Plugin Interface

```typescript
export interface Plugin {
  verifyConditions?: (ctx: CalverReleaseContext) => Promise<void> | void;
  analyzeCommits?: (ctx: CalverReleaseContext) => Promise<CommitAnalysis | null> | CommitAnalysis | null;
  verifyRelease?: (ctx: CalverReleaseContext) => Promise<void> | void;
  generateNotes?: (ctx: CalverReleaseContext) => Promise<string> | string;
  prepare?: (ctx: CalverReleaseContext) => Promise<void> | void;
  publish?: (ctx: CalverReleaseContext) => Promise<PluginResult | PluginResult[]> | PluginResult | PluginResult[];
  success?: (ctx: CalverReleaseContext) => Promise<void> | void;
  fail?: (ctx: CalverReleaseContext, error: Error) => Promise<void> | void;
}
```

### Plugin Factory

Plugins are created using factory functions:

```typescript
export type PluginFactory = (options?: any) => Plugin;
```

## 🔄 Plugin Lifecycle

Plugins are executed in the following order during a release:

1. **`verifyConditions`** - Verify the plugin can run (authentication, environment checks)
2. **`analyzeCommits`** - Analyze commits to determine if a release is needed
3. **`verifyRelease`** - Verify the release is valid and ready
4. **`generateNotes`** - Generate release notes from commits
5. **`prepare`** - Update files (package.json, changelog, etc.)
6. **`publish`** - Publish the release (npm, GitHub, registries)
7. **`success`** - Post-release success actions (notifications, cleanup)
8. **`fail`** - Handle release failures (rollback, error notifications)

### Context Object

Each plugin receives a `CalverReleaseContext` object:

```typescript
export interface CalverReleaseContext {
  cwd?: string;                    // Working directory
  env?: Record<string, string>;    // Environment variables
  stdout?: NodeJS.WriteStream;     // Output stream
  stderr?: NodeJS.WriteStream;     // Error stream
  logger?: Logger;                 // Logging utilities
  options?: CalverReleaseOptions;  // Configuration options
  nextRelease?: NextRelease;       // Release information
  packages?: Package[];            // Monorepo packages
}
```

## 🔧 TypeScript Support

CalVer Release is built with TypeScript and provides full type definitions for plugin development.

### Using TypeScript

```typescript
import { Plugin, CalverReleaseContext, PluginFactory } from 'calver-release';

const myPlugin: PluginFactory = (options: MyPluginOptions = {}): Plugin => {
  return {
    verifyConditions: async (ctx: CalverReleaseContext): Promise<void> => {
      // Plugin logic
    },
    // ... other lifecycle methods
  };
};

export default myPlugin;
```

### Using JavaScript

```javascript
/**
 * @param {any} options
 * @returns {import('calver-release').Plugin}
 */
module.exports = function myPlugin(options = {}) {
  return {
    verifyConditions: async (ctx) => {
      // Plugin logic
    },
    // ... other lifecycle methods
  };
};
```

### Base Plugin Class

For easier development, extend the `BasePlugin` class:

```typescript
import { BasePlugin, CalverReleaseContext } from 'calver-release';

class MyPlugin extends BasePlugin {
  constructor(options: MyPluginOptions = {}) {
    super(options);
  }

  async verifyConditions(ctx: CalverReleaseContext): Promise<void> {
    // Verify plugin can run
  }

  async publish(ctx: CalverReleaseContext) {
    // Publishing logic
    const { nextRelease, logger } = ctx;
    
    const result = await this.publishToCustomPlatform(nextRelease);
    
    logger?.success(`Published: ${result.url}`);
    return result;
  }

  private async publishToCustomPlatform(release: any) {
    // Implementation
    return { type: 'custom', url: 'https://example.com', id: '123' };
  }
}

export default (options: any) => new MyPlugin(options);
```

## 🚀 Development Setup

### 1. Create Plugin Project

```bash
mkdir my-calver-plugin
cd my-calver-plugin
npm init -y
```

### 2. Install Dependencies

```bash
# For TypeScript plugins
npm install --save-dev typescript @types/node
npm install --peer-deps calver-release

# For JavaScript plugins  
npm install --peer-deps calver-release
```

### 3. Basic Plugin Structure

```
my-calver-plugin/
├── src/
│   ├── index.ts          # Main plugin file
│   └── types.ts          # Plugin-specific types
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json         # TypeScript config
└── README.md
```

### 4. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 5. Package.json Setup

```json
{
  "name": "my-calver-plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist/"],
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "peerDependencies": {
    "calver-release": ">=25.0.0"
  },
  "keywords": ["calver-release", "plugin", "release"]
}
```

## 📝 Plugin Examples

### Simple Notification Plugin

```typescript
// src/index.ts
import { Plugin, CalverReleaseContext, PluginFactory } from 'calver-release';
import * as https from 'https';

interface NotificationOptions {
  webhookUrl?: string;
  channel?: string;
}

const notificationPlugin: PluginFactory = (options: NotificationOptions = {}): Plugin => {
  const { webhookUrl, channel = '#releases' } = options;

  return {
    verifyConditions: async (ctx: CalverReleaseContext): Promise<void> => {
      if (!webhookUrl) {
        throw new Error('Webhook URL is required');
      }
    },

    success: async (ctx: CalverReleaseContext): Promise<void> => {
      const { nextRelease, logger } = ctx;
      
      await sendNotification(webhookUrl!, {
        channel,
        text: `🚀 Released ${nextRelease?.version}`,
        version: nextRelease?.version
      });
      
      logger?.success('Notification sent');
    }
  };
};

async function sendNotification(url: string, payload: any): Promise<void> {
  // Implementation details...
}

export default notificationPlugin;
```

### Custom Release Notes Plugin

```typescript
import { Plugin, CalverReleaseContext, PluginFactory } from 'calver-release';

interface CustomNotesOptions {
  template?: string;
  includeLinks?: boolean;
}

const customNotesPlugin: PluginFactory = (options: CustomNotesOptions = {}): Plugin => {
  return {
    generateNotes: async (ctx: CalverReleaseContext): Promise<string> => {
      const { nextRelease } = ctx;
      
      if (nextRelease?.type === 'multi') {
        return generateMultiPackageNotes(nextRelease.releases, options);
      } else {
        return generateSinglePackageNotes(nextRelease, options);
      }
    }
  };
};

function generateMultiPackageNotes(releases: any[], options: CustomNotesOptions): string {
  let notes = '# 📦 Multi-Package Release\\n\\n';
  
  releases?.forEach(release => {
    notes += `## ${release.packageName} v${release.version}\\n`;
    notes += generateChangeList(release.analysis, options);
    notes += '\\n---\\n\\n';
  });
  
  return notes;
}

function generateSinglePackageNotes(release: any, options: CustomNotesOptions): string {
  let notes = `# 🚀 Release ${release?.version}\\n\\n`;
  notes += generateChangeList(release?.analysis, options);
  return notes;
}

function generateChangeList(analysis: any, options: CustomNotesOptions): string {
  if (!analysis?.releaseCommits) return '';
  
  return analysis.releaseCommits
    .map((commit: string) => `- ${commit}`)
    .join('\\n');
}

export default customNotesPlugin;
```

### Registry Publisher Plugin

```typescript
import { Plugin, CalverReleaseContext, PluginResult, PluginFactory } from 'calver-release';
import { execSync } from 'child_process';

interface RegistryOptions {
  registry?: string;
  token?: string;
  scope?: string;
}

const registryPlugin: PluginFactory = (options: RegistryOptions = {}): Plugin => {
  const {
    registry = 'https://npm.pkg.github.com',
    token = process.env.NPM_TOKEN,
    scope
  } = options;

  return {
    verifyConditions: async (ctx: CalverReleaseContext): Promise<void> => {
      if (!token) {
        throw new Error('NPM_TOKEN is required');
      }
      
      // Verify npm is available
      try {
        execSync('npm --version', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('npm is not available');
      }
    },

    prepare: async (ctx: CalverReleaseContext): Promise<void> => {
      const { logger } = ctx;
      
      // Set up npm configuration
      execSync(`npm config set registry ${registry}`);
      execSync(`npm config set //npm.pkg.github.com/:_authToken ${token}`);
      
      if (scope) {
        execSync(`npm config set @${scope}:registry ${registry}`);
      }
      
      logger?.log('Configured npm registry');
    },

    publish: async (ctx: CalverReleaseContext): Promise<PluginResult[]> => {
      const { nextRelease, logger, packages } = ctx;
      const results: PluginResult[] = [];
      
      if (nextRelease?.type === 'multi') {
        // Publish each package
        for (const release of nextRelease.releases || []) {
          const result = await publishPackage(release, logger);
          results.push(result);
        }
      } else if (packages && packages.length > 0) {
        // Single package
        const result = await publishPackage({ 
          package: packages[0], 
          version: nextRelease?.version 
        }, logger);
        results.push(result);
      }
      
      return results;
    }
  };
};

async function publishPackage(release: any, logger: any): Promise<PluginResult> {
  const { package: pkg, version } = release;
  
  logger?.log(`Publishing ${pkg.name}@${version}`);
  
  try {
    const output = execSync(`npm publish ${pkg.path}`, { encoding: 'utf8' });
    
    return {
      type: 'npm',
      url: `https://www.npmjs.com/package/${pkg.name}/v/${version}`,
      id: `${pkg.name}@${version}`
    };
  } catch (error) {
    throw new Error(`Failed to publish ${pkg.name}: ${error}`);
  }
}

export default registryPlugin;
```

## 🧪 Testing Plugins

### Unit Testing

```typescript
// __tests__/plugin.test.ts
import myPlugin from '../src/index';
import { CalverReleaseContext } from 'calver-release';

describe('My Plugin', () => {
  let ctx: CalverReleaseContext;

  beforeEach(() => {
    ctx = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
        info: jest.fn()
      },
      nextRelease: {
        version: '25.07.0.1',
        type: 'single'
      }
    };
  });

  test('should verify conditions', async () => {
    const plugin = myPlugin({ webhookUrl: 'https://example.com' });
    
    await expect(plugin.verifyConditions!(ctx)).resolves.not.toThrow();
  });

  test('should handle success', async () => {
    const plugin = myPlugin({ webhookUrl: 'https://example.com' });
    
    await plugin.success!(ctx);
    
    expect(ctx.logger!.success).toHaveBeenCalledWith('Notification sent');
  });
});
```

### Integration Testing

```typescript
// __tests__/integration.test.ts
import calverRelease from 'calver-release';
import myPlugin from '../src/index';

describe('Plugin Integration', () => {
  test('should work with calver-release', async () => {
    const result = await calverRelease({
      dryRun: true,
      plugins: [
        '@calver-release/commit-analyzer',
        ['../my-plugin', { webhookUrl: 'https://example.com' }]
      ]
    });

    expect(result.released).toBe(false);
    expect(result.dryRun).toBe(true);
  });
});
```

## 📦 Publishing Plugins

### NPM Package

1. **Build and Test**
   ```bash
   npm run build
   npm test
   ```

2. **Publish**
   ```bash
   npm publish
   ```

3. **Use Semantic Versioning**
   - Use semantic versioning for your plugin
   - Document breaking changes clearly

### Plugin Naming Convention

- **Official plugins**: `@calver-release/plugin-name`
- **Community plugins**: `calver-release-plugin-name` or `@scope/calver-release-plugin`

### Package.json Requirements

```json
{
  "keywords": ["calver-release", "plugin", "release"],
  "peerDependencies": {
    "calver-release": ">=25.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/username/plugin-repo"
  }
}
```

## ✅ Best Practices

### Error Handling

```typescript
const myPlugin: PluginFactory = (options = {}) => {
  return {
    verifyConditions: async (ctx) => {
      try {
        // Verification logic
      } catch (error) {
        throw new Error(`Plugin verification failed: ${error.message}`);
      }
    },

    publish: async (ctx) => {
      const { logger } = ctx;
      
      try {
        // Publishing logic
        const result = await publishToService();
        logger?.success('Published successfully');
        return result;
      } catch (error) {
        logger?.error(`Publishing failed: ${error.message}`);
        throw error;
      }
    }
  };
};
```

### Configuration Validation

```typescript
interface MyPluginOptions {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
}

const myPlugin: PluginFactory = (options: MyPluginOptions = {}) => {
  // Validate options
  const {
    apiKey = process.env.API_KEY,
    endpoint = 'https://api.example.com',
    timeout = 5000
  } = options;

  return {
    verifyConditions: async (ctx) => {
      if (!apiKey) {
        throw new Error('API key is required (apiKey option or API_KEY env var)');
      }
      
      if (timeout < 1000) {
        ctx.logger?.warn('Timeout is very low, consider increasing it');
      }
    }
  };
};
```

### Monorepo Support

```typescript
const myPlugin: PluginFactory = (options = {}) => {
  return {
    publish: async (ctx) => {
      const { nextRelease, logger } = ctx;
      
      if (nextRelease?.type === 'multi') {
        // Handle multiple packages
        const results = [];
        for (const release of nextRelease.releases || []) {
          const result = await publishPackage(release);
          results.push(result);
          logger?.log(`Published ${release.packageName}@${release.version}`);
        }
        return results;
      } else {
        // Handle single package
        const result = await publishPackage(nextRelease);
        logger?.log(`Published ${nextRelease?.version}`);
        return result;
      }
    }
  };
};
```

### Logging

```typescript
const myPlugin: PluginFactory = (options = {}) => {
  return {
    publish: async (ctx) => {
      const { logger } = ctx;
      
      // Use appropriate log levels
      logger?.log('Starting publish process');      // Info
      logger?.success('Published successfully');    // Success
      logger?.error('Publishing failed');          // Error
      logger?.warn?.('API rate limit approaching'); // Warning (optional)
    }
  };
};
```

### Environment Variables

```typescript
const myPlugin: PluginFactory = (options = {}) => {
  return {
    verifyConditions: async (ctx) => {
      const { env } = ctx;
      
      // Access environment variables through context
      const apiKey = env?.API_KEY || options.apiKey;
      
      if (!apiKey) {
        throw new Error('API_KEY environment variable required');
      }
    }
  };
};
```

## 🔍 Debugging

### Debug Mode

```typescript
const myPlugin: PluginFactory = (options = {}) => {
  return {
    publish: async (ctx) => {
      const { logger, options: globalOptions } = ctx;
      
      if (globalOptions?.debug) {
        logger?.log('Debug: Publishing with options:', JSON.stringify(options));
      }
      
      // Plugin logic
    }
  };
};
```

### Testing with Dry Run

Always test your plugins with `--dry-run` mode:

```bash
npx calver-release --dry-run --debug
```

This allows you to test plugin logic without actual publishing.

---

## 📚 Additional Resources

- [CalVer Release Documentation](README.md)
- [Built-in Plugin Examples](src/plugins/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [semantic-release Plugin Development](https://semantic-release.gitbook.io/semantic-release/developer-guide/plugin)

Happy plugin development! 🎉