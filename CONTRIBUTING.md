# 🤝 Contributing to CalVer Release

Thank you for your interest in contributing to CalVer Release! This guide will help you get started with development, testing, and contributing to the project.

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🏗️ Development Setup](#️-development-setup)
- [📅 Version Format System](#-version-format-system)
- [🧪 Testing Guidelines](#-testing-guidelines)
- [🔌 Plugin Development](#-plugin-development)
- [📝 Code Standards](#-code-standards)
- [🐛 Bug Reports](#-bug-reports)
- [✨ Feature Requests](#-feature-requests)
- [🔄 Pull Request Process](#-pull-request-process)
- [📖 Documentation](#-documentation)

## 🚀 Quick Start

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/calver-release.git
cd calver-release

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

## 🏗️ Development Setup

### Prerequisites

- **Node.js**: 16.x or higher
- **npm**: 7.x or higher
- **Git**: Latest version
- **TypeScript**: Knowledge of TypeScript is helpful

### Project Structure

```
calver-release/
├── src/
│   ├── index.ts              # Main entry point
│   ├── types.ts              # TypeScript interfaces
│   ├── config.ts             # Configuration handling
│   ├── release-core.js       # Core release logic (JS)
│   └── plugins/              # Built-in plugins
│       ├── npm.ts            # NPM publishing plugin
│       ├── git.ts            # Git operations plugin
│       ├── changelog.ts      # Changelog plugin
│       ├── github.ts         # GitHub releases plugin
│       └── gitlab.ts         # GitLab releases plugin
├── tests/                    # Test files
├── dist/                     # Compiled output
├── docs/                     # Documentation
└── examples/                 # Usage examples
```

### Development Commands

```bash
# Development workflow
npm run dev          # Watch mode compilation
npm run build        # Production build
npm run test         # Run test suite
npm run test:watch   # Watch mode testing
npm run lint         # Code linting
npm run typecheck    # TypeScript checking

# Release workflow
npm run release      # Create a release (uses calver-release itself!)
npm run release:dry  # Preview release without publishing
```

## 📅 Version Format System

CalVer Release supports two version formats. Understanding this system is crucial for contributors:

### 🔧 Core Implementation

The version format system is implemented in:

- **`src/types.ts`**: `versionFormat` option definition
- **`src/release-core.js`**: 
  - `generateCalVerVersion()` - Main version generation logic
  - `determineVersionFormat()` - Auto-detection logic

### 📐 Format Types

#### 4-Part Format: `YY.MM.MINOR.PATCH`
```typescript
// Example: 25.07.1.5
// - YY: Year (25 = 2025)
// - MM: Month (07 = July)  
// - MINOR: Feature releases (increments on feat: commits)
// - PATCH: Bug fixes (increments on fix: commits)
```

#### 3-Part Format: `YY.MM.PATCH`
```typescript
// Example: 25.07.15
// - YY: Year (25 = 2025)
// - MM: Month (07 = July)
// - PATCH: All releases (increments on any commit)
```

### 🎯 Auto-Detection Logic

```typescript
function determineVersionFormat(options = {}) {
  // 1. Explicit setting takes precedence
  if (options.versionFormat && options.versionFormat !== 'auto') {
    return options.versionFormat;
  }
  
  // 2. Auto-detect based on plugins
  if (options.plugins) {
    const hasNpmPlugin = options.plugins.some(plugin => /* NPM detection */);
    if (hasNpmPlugin) {
      return 'YY.MM.PATCH';  // 3-part for NPM compatibility
    }
  }
  
  // 3. Default to 4-part format
  return 'YY.MM.MINOR.PATCH';
}
```

### 🧪 Testing Version Formats

When contributing to version format functionality:

```bash
# Test both formats
node -e "
const { generateCalVerVersion } = require('./dist/src/release-core');

// Test 4-part format
console.log('4-part:', generateCalVerVersion('minor', '.', {}));

// Test 3-part format with NPM plugin
console.log('3-part:', generateCalVerVersion('minor', '.', {
  plugins: ['@calver-release/npm']
}));
"
```

### 📝 Development Guidelines for Version Formats

1. **Backward Compatibility**: Always maintain compatibility with existing tags
2. **Plugin Integration**: NPM plugin should automatically trigger 3-part format
3. **Tag Filtering**: Ensure tag discovery works with both formats
4. **Error Handling**: Handle mixed format scenarios gracefully

## 🧪 Testing Guidelines

### Test Structure

```bash
tests/
├── basic.test.js           # Basic functionality tests
├── version-format.test.js  # Version format specific tests
├── plugins/                # Plugin-specific tests
└── fixtures/               # Test data and scenarios
```

### Writing Tests

#### Unit Tests
```javascript
// Example: Testing version format detection
describe('Version Format Detection', () => {
  test('should use 4-part format by default', () => {
    const format = determineVersionFormat({});
    expect(format).toBe('YY.MM.MINOR.PATCH');
  });

  test('should use 3-part format with NPM plugin', () => {
    const format = determineVersionFormat({
      plugins: ['@calver-release/npm']
    });
    expect(format).toBe('YY.MM.PATCH');
  });
});
```

#### Integration Tests
```javascript
// Example: Testing end-to-end version generation
describe('Version Generation Integration', () => {
  test('should generate correct version for NPM workflow', async () => {
    const result = await calverRelease({
      dryRun: true,
      plugins: ['@calver-release/npm']
    });
    
    expect(result.nextRelease.version).toMatch(/^\d{2}\.\d{2}\.\d+$/);
  });
});
```

### Running Tests

```bash
# Full test suite
npm test

# Specific test file
npm test -- tests/version-format.test.js

# Watch mode during development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Requirements for PRs

- ✅ All existing tests must pass
- ✅ New functionality must include tests
- ✅ Test coverage should not decrease
- ✅ Integration tests for version format changes

## 🔌 Plugin Development

### Plugin Architecture

CalVer Release uses a plugin system similar to semantic-release:

```typescript
import { Plugin, CalverReleaseContext } from '../types';

const myPlugin = (options: any = {}): Plugin => {
  return {
    // Plugin lifecycle methods
    verifyConditions: async (ctx: CalverReleaseContext) => {},
    analyzeCommits: async (ctx: CalverReleaseContext) => {},
    verifyRelease: async (ctx: CalverReleaseContext) => {},
    generateNotes: async (ctx: CalverReleaseContext) => {},
    prepare: async (ctx: CalverReleaseContext) => {},
    publish: async (ctx: CalverReleaseContext) => {},
    success: async (ctx: CalverReleaseContext) => {},
    fail: async (ctx: CalverReleaseContext, error: Error) => {}
  };
};

export default myPlugin;
```

### Version Format Considerations for Plugins

When developing plugins that interact with versions:

1. **NPM Plugin**: Should trigger 3-part format detection
2. **Registry Plugins**: Consider semver compatibility requirements
3. **Tag Plugins**: Handle both format types in tag parsing
4. **Changelog Plugins**: Format-agnostic implementation

### Built-in Plugin Guidelines

If contributing to built-in plugins:

- **Dry-run Support**: Always check `options?.dryRun`
- **Error Handling**: Provide meaningful error messages
- **Logging**: Use the provided logger for consistent output
- **TypeScript**: Full type safety with proper interfaces

Example dry-run pattern:
```typescript
prepare: async (ctx: CalverReleaseContext) => {
  const { logger, options } = ctx;
  
  if (options?.dryRun) {
    logger?.log('Dry run: Skipping file modifications');
    return;
  }
  
  // Actual implementation
}
```

## 📝 Code Standards

### TypeScript Guidelines

- **Strict Mode**: All TypeScript must compile in strict mode
- **Type Safety**: Avoid `any` types when possible
- **Interfaces**: Use proper interfaces from `types.ts`
- **JSDoc**: Document public APIs with JSDoc comments

### Code Style

```typescript
// ✅ Good: Proper typing and error handling
async function updatePackageVersion(
  packagePath: string, 
  version: string
): Promise<void> {
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Package.json not found at ${packageJsonPath}`);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = version;
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

// ❌ Bad: No error handling, loose typing
function updateVersion(path: any, version: any) {
  const pkg = JSON.parse(fs.readFileSync(path + '/package.json'));
  pkg.version = version;
  fs.writeFileSync(path + '/package.json', JSON.stringify(pkg));
}
```

### Linting and Formatting

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check TypeScript compilation
npm run typecheck
```

### Git Conventions

We follow conventional commits:

```bash
# Feature commits (triggers minor version bump in 4-part format)
feat: add support for custom version format
feat(npm): implement 3-part format for NPM compatibility

# Bug fix commits (triggers patch version bump)
fix: handle mixed version format tags correctly
fix(git): resolve tag parsing for 3-part versions

# Other commit types
docs: update CONTRIBUTING.md with version format guidelines
test: add integration tests for version format detection
chore: update dependencies
refactor: improve version format detection logic
```

## 🐛 Bug Reports

When reporting bugs, please include:

### Basic Information
- **Version**: CalVer Release version
- **Node.js**: Version and platform
- **Environment**: CI/CD system if applicable

### Version Format Context
- **Format Used**: 4-part or 3-part
- **Configuration**: Plugin configuration
- **Expected Format**: What format you expected
- **Actual Result**: What actually happened

### Reproduction Steps
```bash
# Example bug report template
1. Configure with NPM plugin
2. Run: npx calver-release --dry-run
3. Observe version format in output
4. Expected: 25.07.1 (3-part)
5. Actual: 25.07.0.1 (4-part)
```

### Debug Information
```bash
# Include debug output
npx calver-release --debug --dry-run > debug.log 2>&1
```

## ✨ Feature Requests

### Version Format Related Features

When proposing version format enhancements:

1. **Use Case**: Describe the scenario requiring the change
2. **Current Limitation**: What doesn't work today
3. **Proposed Solution**: How should it work
4. **Compatibility**: Impact on existing functionality
5. **Implementation**: High-level approach

### Feature Template

```markdown
## Feature Request: [Title]

**Use Case**: 
As a developer using CalVer Release with [specific scenario], I want [capability] so that [benefit].

**Current Behavior**:
Currently, [description of limitation].

**Proposed Behavior**:
The tool should [description of desired behavior].

**Version Format Impact**:
- 4-part format: [impact]
- 3-part format: [impact]
- NPM compatibility: [considerations]

**Implementation Ideas**:
- [ ] Changes to `src/release-core.js`
- [ ] Updates to `determineVersionFormat()`
- [ ] Plugin modifications
- [ ] Configuration options
```

## 🔄 Pull Request Process

### Before Submitting

1. **Branch Naming**: Use descriptive branch names
   ```bash
   # Examples
   git checkout -b feat/version-format-override
   git checkout -b fix/npm-plugin-detection
   git checkout -b docs/contributing-version-formats
   ```

2. **Testing**: Ensure all tests pass
   ```bash
   npm run build && npm test
   ```

3. **Linting**: Fix any linting issues
   ```bash
   npm run lint:fix
   ```

### PR Template

When submitting a PR, please include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

## Version Format Impact
- [ ] No impact on version formats
- [ ] Affects 4-part format behavior
- [ ] Affects 3-part format behavior
- [ ] Changes auto-detection logic
- [ ] Requires configuration migration

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Both version formats tested

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes without discussion
```

### Review Process

1. **Automated Checks**: CI must pass
2. **Code Review**: At least one maintainer review
3. **Testing**: Both automated and manual testing
4. **Documentation**: Updated if needed
5. **Version Format Testing**: Both formats validated

### Merge Requirements

- ✅ All CI checks passing
- ✅ Approved by maintainer
- ✅ No merge conflicts
- ✅ Documentation updated (if needed)
- ✅ Tests cover new functionality

## 📖 Documentation

### Documentation Updates

When contributing, update relevant documentation:

1. **README.md**: User-facing features and configuration
2. **CONTRIBUTING.md**: Development and contribution guidelines
3. **Code Comments**: Technical implementation details
4. **Examples**: Usage examples for new features

### Version Format Documentation

When documenting version format features:

- **Examples**: Provide examples for both formats
- **Use Cases**: Explain when to use each format
- **Migration**: Guide users through format changes
- **Troubleshooting**: Common issues and solutions

### Writing Guidelines

- **Clear Examples**: Show actual code and output
- **Progressive Disclosure**: Start simple, add complexity
- **Cross-References**: Link between related sections
- **Visual Aids**: Use tables and diagrams when helpful

## 🚀 Release Process

CalVer Release uses itself for releases! Here's how:

```bash
# Create a release
npm run release

# Preview release
npm run release:dry

# The tool will:
# 1. Analyze commits
# 2. Determine version format (3-part due to NPM plugin)
# 3. Generate version (e.g., 25.07.2)
# 4. Update CHANGELOG.md
# 5. Create Git tag
# 6. Publish to NPM
# 7. Create GitHub release
```

### Version Format for CalVer Release

This project uses:
- **3-part format** (`YY.MM.PATCH`) for NPM publishing
- **Auto-detection** via NPM plugin configuration
- **Conventional commits** for release type determination

## 🤝 Community

### Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community support
- **Code Review**: Learn through PR feedback

### Contributing Philosophy

- **Quality Over Quantity**: Well-tested, documented contributions
- **User Focus**: Consider impact on end users
- **Backward Compatibility**: Preserve existing workflows
- **Incremental Improvement**: Small, focused changes

---

Thank you for contributing to CalVer Release! 🎉

For questions about contributing, please open a GitHub issue or discussion.