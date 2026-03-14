## [26.03.1] - 2026-03-14

### ✨ Features
- feat: Allow single-digit months in CalVer versions via a new `padMonth` option, expand config file support to `.cjs` and `.mjs`, and refine npm plugin option parsing.

## [25.07.2] - 2025-07-14

### ✨ Features
- feat: now we support both format of version

### 🐛 Bug Fixes
- fix: version not upgrade when create tag

## [25.07.1] - 2025-07-14

### ✨ Features
- feat(Initial commit): CalVer Release tool with autoUpdateMonth feature

### 🐛 Bug Fixes
- fix: now we support with this format of version `YY.MM.PATCH` but will be support this format too `YY.MM.MINOR.PATCH soon
- fix: npm publish unexpected non-whitespace
- fix: improve changelog and fix unit test
- fix: fix unit test
- fix: fix analyze commits not catch the rule commit

## [25.07.0.1] - 2025-07-14
### 🐛 Bug Fixes 
- fix: fix analyze commits not catch the rule commit 

### ✨ Feature 
- feat(Initial commit): CalVer Release tool with autoUpdateMonth feature
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Calendar Versioning](https://calver.org/).

## [25.07.0.1] - 2025-07-11

### Added
- **Full TypeScript Support** - Native TypeScript implementation with complete type definitions
- **Enhanced Plugin Development** - Comprehensive plugin interfaces and base classes
- **Plugin Development Guide** - Detailed documentation for creating custom plugins
- **Real-world Plugin Examples** - Slack notifier, custom release notes, Docker publisher examples
- **BasePlugin Class** - Abstract base class for easier plugin development
- **Comprehensive README** - Detailed usage examples and configuration guide

### Enhanced
- **Type Safety** - Full TypeScript types for all APIs and plugin interfaces
- **Developer Experience** - Better IntelliSense and error checking
- **Plugin Architecture** - More robust plugin loading and error handling
- **Documentation** - Extensive examples for custom plugin development

### Technical
- TypeScript compilation with source maps and declarations
- Plugin factory pattern with proper type inference
- Comprehensive interface definitions for all plugin lifecycle methods
- Build system improvements for TypeScript output

## [25.07.0.0] - 2025-07-11

### Added
- Initial release of calver-release
- Semantic-release style API for CalVer versioning
- Full monorepo support (npm workspaces, Lerna, pnpm, Nx)
- Built-in plugins system
- GitHub and GitLab integration
- Conventional commits analysis
- Automatic changelog generation
- CLI tool with semantic-release compatible commands
- TypeScript definitions
- Comprehensive documentation

### Features
- 📅 CalVer versioning (YY.MM.MINOR.PATCH)
- 🏢 First-class monorepo support
- 🔌 Extensible plugin system
- 🐙 GitHub releases integration
- 🦮 GitLab releases integration
- 📝 Conventional commits support
- 📋 Automatic changelog updates
- 🎯 Smart change detection
- 🧪 Dry run mode
- 📦 Independent package versioning

### Plugins
- `@calver-release/commit-analyzer` - Analyze conventional commits
- `@calver-release/release-notes-generator` - Generate release notes
- `@calver-release/changelog` - Update CHANGELOG.md
- `@calver-release/npm` - Update package.json versions
- `@calver-release/git` - Create tags and commit changes
- `@calver-release/github` - Create GitHub releases
- `@calver-release/gitlab` - Create GitLab releases