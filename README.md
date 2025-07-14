# 📅 CalVer Release

**Fully automated CalVer releases with first-class monorepo support**

CalVer Release is a **semantic-release alternative** that uses **Calendar Versioning (CalVer)** instead of Semantic Versioning. Built from the ground up with TypeScript and designed for modern monorepo workflows.

[![npm version](https://badge.fury.io/js/calver-release.svg)](https://www.npmjs.com/package/calver-release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 📅 **CalVer Versioning** - `YY.MM.MINOR.PATCH` format
- 🏢 **First-class Monorepo Support** - npm workspaces, Lerna, pnpm, Nx
- 🔌 **Plugin Architecture** - Extensible like semantic-release
- 🐙 **GitHub & GitLab Integration** - Automatic releases and notes
- 📝 **Conventional Commits** - Automatic change detection
- 🧪 **Dry Run Mode** - Preview releases without publishing
- 📦 **Independent Package Versioning** - Each package gets its own version
- 🎯 **Smart Change Detection** - Only release what changed
- 🔧 **TypeScript Native** - Full TypeScript support with excellent DX

## 🚀 Quick Start

### Installation

```bash
npm install --save-dev calver-release

# Or globally
npm install -g calver-release
```

### Basic Usage

```bash
# Run release process
npx calver-release

# Preview without releasing
npx calver-release --dry-run

# Debug mode
npx calver-release --debug
```

### Programmatic Usage

```typescript
import calverRelease from 'calver-release';

// Basic release
await calverRelease();

// With options
await calverRelease({
  dryRun: true,
  branches: ['main'],
  debug: true
});
```

## 📖 Configuration

CalVer Release supports multiple configuration methods:

### Version Format Options

- **Format**: `YY.MM.MINOR.PATCH` (e.g., `25.07.0.1`)
- **autoUpdateMonth**: Controls automatic month updates
  - `false` (default): Manual month control via package.json version
  - `true`: Automatically updates to current `YY.MM` when new month arrives

**Behavior Examples:**

```bash
# autoUpdateMonth: false (default)
# package.json: "25.07.0.1" 
# August release → "25.07.0.2" (stays in July)

# autoUpdateMonth: true  
# package.json: "25.07.0.1"
# August release → "25.08.0.1" (auto-updates to August)

# Manual override (works with both settings)
# package.json: "25.12.0.0" 
# Any release → "25.12.0.1" (uses December from package.json)
```

### package.json

```json
{
  "calver-release": {
    "branches": ["main", "master"],
    "autoUpdateMonth": false,
    "plugins": [
      "@calver-release/commit-analyzer",
      "@calver-release/release-notes-generator",
      "@calver-release/changelog",
      "@calver-release/npm",
      "@calver-release/git",
      "@calver-release/github"
    ]
  }
}
```

### .calver-releaserc.json

```json
{
  "branches": ["main"],
  "tagFormat": "v-${version}",
  "autoUpdateMonth": false,
  "plugins": [
    "@calver-release/commit-analyzer",
    "@calver-release/release-notes-generator",
    "@calver-release/changelog",
    "@calver-release/npm",
    "@calver-release/git",
    "@calver-release/github"
  ]
}
```

### calver-release.config.js (Advanced)

```javascript
module.exports = {
  branches: ['main'],
  autoUpdateMonth: true, // Automatically update to current YY.MM when new month arrives
  plugins: [
    '@calver-release/commit-analyzer',
    ['@calver-release/release-notes-generator', {
      preset: 'conventionalcommits'
    }],
    '@calver-release/changelog',
    '@calver-release/npm',
    '@calver-release/git',
    ['@calver-release/github', {
      assets: ['dist/**']
    }]
  ]
};
```

## 🏢 Monorepo Support

CalVer Release automatically detects and supports multiple monorepo tools:

- **npm workspaces** - `package.json` workspaces field
- **Lerna** - `lerna.json` configuration  
- **pnpm** - `pnpm-workspace.yaml`
- **Nx** - `nx.json` workspace configuration

### Example Monorepo Structure

```
my-monorepo/
├── packages/
│   ├── core/
│   │   └── package.json
│   ├── ui/
│   │   └── package.json
│   └── api/
│       └── package.json
├── package.json           # Root package with workspaces
└── calver-release.config.js
```

### Monorepo Tags

For monorepos, CalVer Release creates package-specific tags:

```bash
v-25.07.0.14-core-release    # Core package v25.07.0.14
v-25.07.0.15-ui-release      # UI package v25.07.0.15  
v-25.07.0.16-api-release     # API package v25.07.0.16
```

## 🔌 Built-in Plugins

| Plugin | Description |
|--------|-------------|
| `@calver-release/commit-analyzer` | Analyzes conventional commits |
| `@calver-release/release-notes-generator` | Generates release notes |
| `@calver-release/changelog` | Updates CHANGELOG.md |
| `@calver-release/npm` | Updates package.json versions |
| `@calver-release/git` | Creates tags and commits |
| `@calver-release/github` | Creates GitHub releases |
| `@calver-release/gitlab` | Creates GitLab releases |

## 🛠️ Custom Plugin Development

### Plugin Interface

CalVer Release plugins follow the **semantic-release plugin pattern** with TypeScript support:

```typescript
import { Plugin, CalverReleaseContext } from 'calver-release';

const myPlugin = (options: any = {}): Plugin => {
  return {
    verifyConditions: async (ctx: CalverReleaseContext) => {
      // Verify plugin can run (auth, environment, etc.)
    },
    
    analyzeCommits: async (ctx: CalverReleaseContext) => {
      // Analyze commits and determine release type
      return {
        shouldRelease: true,
        releaseType: 'minor',
        hasBreakingChange: false,
        hasFeature: true,
        hasFix: false,
        releaseCommits: ['feat: add new feature']
      };
    },
    
    generateNotes: async (ctx: CalverReleaseContext) => {
      // Generate custom release notes
      const { nextRelease } = ctx;
      return `## Release ${nextRelease?.version}\n\nCustom release notes here...`;
    },
    
    prepare: async (ctx: CalverReleaseContext) => {
      // Update files before release
    },
    
    publish: async (ctx: CalverReleaseContext) => {
      // Publish to custom registry/platform
      return {
        type: 'custom',
        url: 'https://my-registry.com/release/123',
        id: 'release-123'
      };
    },
    
    success: async (ctx: CalverReleaseContext) => {
      // Post-release success actions
    },
    
    fail: async (ctx: CalverReleaseContext, error: Error) => {
      // Handle release failure
    }
  };
};

export default myPlugin;
```

### Using the Base Plugin Class

For easier development, extend the `BasePlugin` class:

```typescript
import { BasePlugin, CalverReleaseContext } from 'calver-release';

class MyCustomPlugin extends BasePlugin {
  constructor(options: any = {}) {
    super(options);
  }

  async verifyConditions(ctx: CalverReleaseContext): Promise<void> {
    if (!process.env.MY_TOKEN) {
      throw new Error('MY_TOKEN environment variable required');
    }
  }

  async publish(ctx: CalverReleaseContext) {
    const { nextRelease, logger } = ctx;
    
    // Custom publishing logic
    const result = await this.publishToCustomPlatform(nextRelease);
    
    logger?.success(`Published to custom platform: ${result.url}`);
    
    return {
      type: 'custom-platform',
      url: result.url,
      id: result.id
    };
  }

  private async publishToCustomPlatform(release: any) {
    // Implementation details...
    return { url: 'https://example.com', id: '123' };
  }
}

// Export as factory function
export default (options: any) => new MyCustomPlugin(options);
```

## 📝 Real-World Plugin Examples

### Custom Slack Notifier

```typescript
import { Plugin, CalverReleaseContext } from 'calver-release';
import https from 'https';

interface SlackOptions {
  webhookUrl?: string;
  channel?: string;
  username?: string;
}

const slackNotifier = (options: SlackOptions = {}): Plugin => {
  const {
    webhookUrl = process.env.SLACK_WEBHOOK_URL,
    channel = '#releases',
    username = 'CalVer Release Bot'
  } = options;

  return {
    verifyConditions: async (ctx) => {
      if (!webhookUrl) {
        throw new Error('Slack webhook URL required (SLACK_WEBHOOK_URL)');
      }
    },

    success: async (ctx: CalverReleaseContext) => {
      const { nextRelease, logger } = ctx;
      
      const message = {
        channel,
        username,
        text: `🚀 New Release Published!`,
        attachments: [{
          color: 'good',
          fields: [
            {
              title: 'Version',
              value: nextRelease?.version,
              short: true
            },
            {
              title: 'Type',
              value: nextRelease?.type === 'multi' ? 'Multi-package' : 'Single package',
              short: true
            }
          ]
        }]
      };

      await sendSlackMessage(webhookUrl, message);
      logger?.success('Slack notification sent');
    }
  };
};

async function sendSlackMessage(webhookUrl: string, message: any): Promise<void> {
  const payload = JSON.stringify(message);
  const url = new URL(webhookUrl);
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Slack notification failed: ${res.statusCode}`));
      }
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export default slackNotifier;
```

### Custom Release Notes Generator

```typescript
import { Plugin, CalverReleaseContext } from 'calver-release';

interface CustomNotesOptions {
  template?: 'minimal' | 'detailed' | 'changelog';
  includeAuthors?: boolean;
  groupByType?: boolean;
}

const customReleaseNotes = (options: CustomNotesOptions = {}): Plugin => {
  const {
    template = 'detailed',
    includeAuthors = true,
    groupByType = true
  } = options;

  return {
    generateNotes: async (ctx: CalverReleaseContext): Promise<string> => {
      const { nextRelease } = ctx;
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        return generateMultiPackageNotes(nextRelease.releases, options);
      } else if (nextRelease) {
        return generateSinglePackageNotes(nextRelease as any, options);
      }
      
      return '';
    }
  };
};

function generateMultiPackageNotes(releases: any[], options: CustomNotesOptions): string {
  let notes = `# 📦 Multi-Package Release\n\n`;
  
  releases.forEach(release => {
    notes += `## ${release.packageName || 'root'} v${release.version}\n\n`;
    notes += generateCommitList(release.analysis, options);
    notes += '\n---\n\n';
  });
  
  return notes;
}

function generateSinglePackageNotes(release: any, options: CustomNotesOptions): string {
  let notes = `# 🚀 Release ${release.version}\n\n`;
  
  if (options.template === 'detailed') {
    notes += `### Release Overview\n`;
    notes += `- **Features**: ${release.analysis.hasFeature ? '✅' : '❌'}\n`;
    notes += `- **Bug Fixes**: ${release.analysis.hasFix ? '✅' : '❌'}\n`;
    notes += `- **Breaking Changes**: ${release.analysis.hasBreakingChange ? '⚠️' : '❌'}\n\n`;
  }
  
  notes += generateCommitList(release.analysis, options);
  
  return notes;
}

function generateCommitList(analysis: any, options: CustomNotesOptions): string {
  if (!options.groupByType) {
    return analysis.releaseCommits.map((commit: string) => `- ${commit}`).join('\n');
  }
  
  const grouped = analysis.releaseCommits.reduce((acc: any, commit: string) => {
    const type = commit.match(/^(feat|fix|docs|style|refactor|test|chore):/)?.[1] || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(commit);
    return acc;
  }, {});
  
  let notes = '';
  const typeLabels: Record<string, string> = {
    feat: '🚀 Features',
    fix: '🐛 Bug Fixes',
    docs: '📚 Documentation',
    style: '💄 Styling',
    refactor: '♻️ Refactoring',
    test: '🧪 Tests',
    chore: '🔧 Maintenance',
    other: '📝 Other Changes'
  };
  
  Object.entries(grouped).forEach(([type, commits]: [string, any]) => {
    notes += `### ${typeLabels[type] || type}\n\n`;
    commits.forEach((commit: string) => {
      notes += `- ${commit}\n`;
    });
    notes += '\n';
  });
  
  return notes;
}

export default customReleaseNotes;
```

### Docker Registry Publisher

```typescript
import { Plugin, CalverReleaseContext } from 'calver-release';
import { execSync } from 'child_process';

interface DockerOptions {
  registry?: string;
  imageName?: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
}

const dockerPublisher = (options: DockerOptions = {}): Plugin => {
  const {
    registry = process.env.DOCKER_REGISTRY || 'docker.io',
    imageName = process.env.DOCKER_IMAGE_NAME,
    dockerfile = 'Dockerfile',
    buildArgs = {}
  } = options;

  return {
    verifyConditions: async (ctx) => {
      if (!imageName) {
        throw new Error('Docker image name required (imageName option or DOCKER_IMAGE_NAME env)');
      }
      
      // Check if Docker is available
      try {
        execSync('docker --version', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('Docker is not installed or not accessible');
      }
    },

    prepare: async (ctx: CalverReleaseContext) => {
      const { nextRelease, logger } = ctx;
      
      if (nextRelease?.type === 'multi') {
        // Handle multiple packages
        for (const release of nextRelease.releases || []) {
          await buildDockerImage(release.packageName || 'root', release.version, options, logger);
        }
      } else if (nextRelease) {
        await buildDockerImage(imageName, (nextRelease as any).version, options, logger);
      }
    },

    publish: async (ctx: CalverReleaseContext) => {
      const { nextRelease, logger } = ctx;
      const results = [];
      
      if (nextRelease?.type === 'multi') {
        for (const release of nextRelease.releases || []) {
          const result = await publishDockerImage(release.packageName || 'root', release.version, options, logger);
          results.push(result);
        }
      } else if (nextRelease) {
        const result = await publishDockerImage(imageName, (nextRelease as any).version, options, logger);
        results.push(result);
      }
      
      return results;
    }
  };
};

async function buildDockerImage(imageName: string, version: string, options: DockerOptions, logger: any) {
  const tag = `${options.registry}/${imageName}:${version}`;
  const latestTag = `${options.registry}/${imageName}:latest`;
  
  let buildCmd = `docker build -t ${tag} -t ${latestTag}`;
  
  // Add build args
  Object.entries(options.buildArgs || {}).forEach(([key, value]) => {
    buildCmd += ` --build-arg ${key}=${value}`;
  });
  
  buildCmd += ` -f ${options.dockerfile} .`;
  
  logger?.log(`Building Docker image: ${tag}`);
  execSync(buildCmd, { stdio: 'inherit' });
}

async function publishDockerImage(imageName: string, version: string, options: DockerOptions, logger: any) {
  const tag = `${options.registry}/${imageName}:${version}`;
  const latestTag = `${options.registry}/${imageName}:latest`;
  
  logger?.log(`Publishing Docker image: ${tag}`);
  
  execSync(`docker push ${tag}`, { stdio: 'inherit' });
  execSync(`docker push ${latestTag}`, { stdio: 'inherit' });
  
  return {
    type: 'docker',
    url: `${options.registry}/${imageName}:${version}`,
    id: tag
  };
}

export default dockerPublisher;
```

## 🔧 Using Custom Plugins

### In Configuration

```javascript
// calver-release.config.js
module.exports = {
  plugins: [
    '@calver-release/commit-analyzer',
    '@calver-release/release-notes-generator',
    
    // Local custom plugin
    ['./plugins/slack-notifier', {
      channel: '#releases',
      webhookUrl: process.env.SLACK_WEBHOOK
    }],
    
    // NPM package plugin
    ['my-custom-calver-plugin', {
      apiKey: process.env.CUSTOM_API_KEY
    }],
    
    // Custom release notes
    ['./plugins/custom-release-notes', {
      template: 'detailed',
      includeAuthors: true
    }],
    
    '@calver-release/changelog',
    '@calver-release/npm',
    '@calver-release/git',
    '@calver-release/github'
  ]
};
```

## 🌍 Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token for releases |
| `GITLAB_ACCESS_TOKEN` | GitLab API token for releases |
| `CI_PROJECT_ID` | GitLab project ID |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © [CalVer Release Contributors](LICENSE)

---

**CalVer Release** - *Automated calendar versioning for the modern age* 📅✨