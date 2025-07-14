const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Detect monorepo configuration
function detectMonorepoConfig() {
  const configs = {
    lerna: 'lerna.json',
    nx: 'nx.json', 
    rush: 'rush.json',
    pnpmWorkspace: 'pnpm-workspace.yaml',
    npmWorkspaces: null // Will check package.json
  };
  
  // Check for config files
  for (const [type, filename] of Object.entries(configs)) {
    if (filename && fs.existsSync(filename)) {
      console.log(`📦 Detected ${type} monorepo configuration`);
      return { type, configFile: filename };
    }
  }
  
  // Check for npm workspaces in package.json
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.workspaces) {
      console.log('📦 Detected npm workspaces configuration');
      return { type: 'npmWorkspaces', workspaces: packageJson.workspaces };
    }
  }
  
  console.log('📦 No monorepo configuration detected, using single-package mode');
  return { type: 'single' };
}

// Discover workspace packages
function discoverWorkspaces(monorepoConfig) {
  if (monorepoConfig.type === 'single') {
    return [{ name: 'root', path: '.', packageJson: 'package.json' }];
  }
  
  const packages = [];
  
  try {
    switch (monorepoConfig.type) {
      case 'lerna':
        const lernaConfig = JSON.parse(fs.readFileSync('lerna.json', 'utf8'));
        const lernaPackages = lernaConfig.packages || ['packages/*'];
        packages.push(...expandGlobPatterns(lernaPackages));
        break;
        
      case 'nx':
        // Nx can use project.json or package.json in subdirs
        const nxConfig = JSON.parse(fs.readFileSync('nx.json', 'utf8'));
        if (nxConfig.workspaceLayout && nxConfig.workspaceLayout.libsDir) {
          packages.push(...findPackagesInDir(nxConfig.workspaceLayout.libsDir));
        }
        if (nxConfig.workspaceLayout && nxConfig.workspaceLayout.appsDir) {
          packages.push(...findPackagesInDir(nxConfig.workspaceLayout.appsDir));
        }
        // Fallback to common patterns
        if (packages.length === 0) {
          packages.push(...expandGlobPatterns(['packages/*', 'apps/*', 'libs/*']));
        }
        break;
        
      case 'pnpmWorkspace':
        try {
          const yaml = require('js-yaml');
          const pnpmConfig = yaml.parse(fs.readFileSync('pnpm-workspace.yaml', 'utf8'));
          packages.push(...expandGlobPatterns(pnpmConfig.packages || []));
        } catch (yamlError) {
          console.log('⚠️  js-yaml not available, falling back to basic parsing');
          // Basic YAML parsing for packages list
          const yamlContent = fs.readFileSync('pnpm-workspace.yaml', 'utf8');
          const packagesMatch = yamlContent.match(/packages:\\s*([\\s\\S]*?)(?:\\n\\w|$)/);
          if (packagesMatch) {
            const packageLines = packagesMatch[1].split('\\n')
              .map(line => line.trim())
              .filter(line => line.startsWith('- '))
              .map(line => line.substring(2).replace(/["']/g, ''));
            packages.push(...expandGlobPatterns(packageLines));
          }
        }
        break;
        
      case 'npmWorkspaces':
        const workspaces = Array.isArray(monorepoConfig.workspaces) 
          ? monorepoConfig.workspaces 
          : monorepoConfig.workspaces.packages || [];
        packages.push(...expandGlobPatterns(workspaces));
        break;
    }
  } catch (error) {
    console.log(`⚠️  Error reading monorepo config: ${error.message}`);
    return [{ name: 'root', path: '.', packageJson: 'package.json' }];
  }
  
  // Filter packages that actually exist and have package.json
  const validPackages = packages.filter(pkg => {
    const packageJsonPath = path.join(pkg.path, 'package.json');
    return fs.existsSync(packageJsonPath);
  });
  
  console.log(`📦 Found ${validPackages.length} workspace packages: ${validPackages.map(p => p.name).join(', ')}`);
  return validPackages;
}

// Expand glob patterns to find packages
function expandGlobPatterns(patterns) {
  const packages = [];
  
  for (const pattern of patterns) {
    try {
      // Simple glob expansion for common patterns like 'packages/*'
      if (pattern.includes('*')) {
        const baseDir = pattern.split('*')[0];
        if (fs.existsSync(baseDir)) {
          const dirs = fs.readdirSync(baseDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
          
          for (const dir of dirs) {
            const pkgPath = path.join(baseDir, dir);
            const packageJsonPath = path.join(pkgPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              packages.push({
                name: packageJson.name || dir,
                path: pkgPath,
                packageJson: packageJsonPath
              });
            }
          }
        }
      } else {
        // Direct path
        const packageJsonPath = path.join(pattern, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          packages.push({
            name: packageJson.name || path.basename(pattern),
            path: pattern,
            packageJson: packageJsonPath
          });
        }
      }
    } catch (error) {
      console.log(`⚠️  Error processing pattern ${pattern}: ${error.message}`);
    }
  }
  
  return packages;
}

// Find packages in a directory
function findPackagesInDir(dir) {
  const packages = [];
  
  if (!fs.existsSync(dir)) {
    return packages;
  }
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isDirectory()) {
      const pkgPath = path.join(dir, item.name);
      const packageJsonPath = path.join(pkgPath, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packages.push({
          name: packageJson.name || item.name,
          path: pkgPath,
          packageJson: packageJsonPath
        });
      }
    }
  }
  
  return packages;
}

// Get changed packages based on git changes
function getChangedPackages(packages, commitMessages) {
  if (packages.length === 1 && packages[0].name === 'root') {
    return packages; // Single package mode
  }
  
  const changedPackages = new Set();
  
  try {
    // Get changed files since last tag
    let latestTag = null;
    try {
      latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    } catch (error) {
      // No tags found, check all files
    }
    
    let changedFiles;
    if (latestTag) {
      try {
        changedFiles = execSync(`git diff --name-only ${latestTag}..HEAD`, { encoding: 'utf8' }).trim().split('\\n');
      } catch (error) {
        changedFiles = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' }).trim().split('\\n');
      }
    } else {
      changedFiles = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\\n');
    }
    
    // Map changed files to packages
    for (const file of changedFiles) {
      if (!file.trim()) continue;
      
      for (const pkg of packages) {
        if (pkg.path === '.' || file.startsWith(pkg.path + '/')) {
          changedPackages.add(pkg);
          break;
        }
      }
    }
    
    // Also check for scope-specific commits
    const commits = commitMessages.split('\n').filter(line => line.trim());
    for (const commit of commits) {
      const message = commit.substring(8); // Remove hash prefix
      
      // Look for scoped commits like 'feat(package-name): description'
      const scopeMatch = message.match(/^\w+\(([^)]+)\):/);
      if (scopeMatch) {
        const scope = scopeMatch[1];
        const matchingPkg = packages.find(pkg => 
          pkg.name.includes(scope) || 
          pkg.path.includes(scope) ||
          path.basename(pkg.path) === scope
        );
        if (matchingPkg) {
          changedPackages.add(matchingPkg);
        }
      }
    }
    
  } catch (error) {
    console.log(`⚠️  Error detecting changed packages: ${error.message}`);
    return packages; // Return all packages if detection fails
  }
  
  const result = Array.from(changedPackages);
  console.log(`📦 Changed packages: ${result.map(p => p.name).join(', ')}`);
  
  return result.length > 0 ? result : packages; // Return all if none detected
}

// Analyze commits using conventional commit format
function analyzeCommits(commitMessages, packagePath = '.') {
  const commits = commitMessages.split('\n').filter(line => line.trim());
  
  let hasFeature = false;
  let hasFix = false;
  let hasBreakingChange = false;
  let releaseCommits = [];
  
  for (const commit of commits) {
    const spaceIndex = commit.indexOf(' ');
    const message = spaceIndex > 0 ? commit.substring(spaceIndex + 1) : commit; // Remove hash prefix
    
    // For monorepo, check if commit affects this package
    if (packagePath !== '.') {
      const scopeMatch = message.match(/^\w+\(([^)]+)\):/);
      if (scopeMatch) {
        const scope = scopeMatch[1];
        const pkgName = path.basename(packagePath);
        // Skip commits that don't match this package scope
        if (scope !== pkgName && !scope.includes(pkgName)) {
          continue;
        }
      }
    }
    
    // Check for conventional commit types
    if (message.match(/^feat(\(.+\))?:/)) {
      hasFeature = true;
      releaseCommits.push(`✨ ${message}`);
    } else if (message.match(/^fix(\(.+\))?:/)) {
      hasFix = true;
      releaseCommits.push(`🐛 ${message}`);
    } else if (message.match(/^perf(\(.+\))?:/)) {
      hasFix = true; // Performance improvements count as fixes
      releaseCommits.push(`⚡ ${message}`);
    } else if (message.includes('BREAKING CHANGE') || message.match(/^.+!:/)) {
      hasBreakingChange = true;
      releaseCommits.push(`💥 ${message}`);
    }
    
    // Check for breaking changes in commit body/footer
    if (message.includes('BREAKING CHANGE:')) {
      hasBreakingChange = true;
    }
    
    // Skip these commit types (no release)
    if (message.match(/^(chore|docs|style|refactor|test|ci|build)(\\(.+\\))?:/)) {
      console.log(`⏭️  Skipping: ${message}`);
      continue;
    }
  }
  
  // Determine if we should release
  const shouldRelease = hasFeature || hasFix || hasBreakingChange || releaseCommits.length > 0;
  
  if (!shouldRelease) {
    console.log('No release-worthy commits found (feat, fix, BREAKING CHANGE)');
    return null;
  }
  
  console.log(`\n📋 Release commits found:`);
  releaseCommits.forEach(commit => console.log(`   ${commit}`));
  
  // In CalVer, we always do patch increments, but track the type for release notes
  const releaseType = hasBreakingChange ? 'major' : hasFeature ? 'minor' : 'patch';
  
  return {
    shouldRelease: true,
    releaseType,
    hasBreakingChange,
    hasFeature,
    hasFix,
    releaseCommits
  };
}

// Generate CalVer version for a specific package
function generateCalVerVersion(releaseType, packagePath = '.', options = {}) {
  // Determine version format
  const versionFormat = determineVersionFormat(options);
  const isNpmCompatible = versionFormat === 'YY.MM.PATCH';
  
  console.log(`Using version format: ${versionFormat}`);
  
  // Read package.json version
  let packageJsonVersion = null;
  const packageJsonPath = path.join(packagePath, 'package.json');
  try {
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJsonVersion = packageJson.version;
      console.log(`Found package.json version for ${packagePath}: ${packageJsonVersion}`);
    }
  } catch (error) {
    console.log(`Could not read package.json version for ${packagePath}`);
  }
  
  // Get existing git tags (look for CalVer tags only)
  let existingTags = [];
  try {
    const tagOutput = execSync('git tag -l --sort=-version:refname', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] 
    });
    
    const packageName = packagePath === '.' ? '' : path.basename(packagePath);
    
    existingTags = tagOutput
      .split('\\n')
      .filter(tag => tag.trim())
      .filter(tag => {
        if (packageName) {
          // For packages: match v-VERSION-PACKAGE-release format
          return tag.includes(`-${packageName}-release`);
        } else {
          // For single repo: match v-VERSION format (no package suffix)
          return tag.match(/^v-\d{2}\.\d{2}\.\d+(\.\d+)?$/);
        }
      })
      .map(tag => {
        if (packageName) {
          // Extract version from v-VERSION-PACKAGE-release
          const match = tag.match(/^v-(\d{2}\.\d{2}\.\d+(?:\.\d+)?)-/);
          return match ? match[1] : '';
        } else {
          // Extract version from v-VERSION
          return tag.replace(/^v-/, '');
        }
      })
      .filter(tag => tag.match(/^\d{2}\.\d{2}\.\d+(\.\d+)?$/)); // Both 3-part and 4-part CalVer tags
  } catch (error) {
    console.log('No existing tags found');
  }
  
  console.log(`Found ${existingTags.length} existing CalVer tags: [${existingTags.slice(0, 3).join(', ')}]`);
  
  // Determine target YY.MM
  let targetYearMonth;
  let isManualBump = false;
  let isAutoMonthUpdate = false;
  
  // Get current date
  const now = new Date();
  const currentYear = now.getFullYear().toString().slice(-2);
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const currentYearMonth = `${currentYear}.${currentMonth}`;
  
  if (packageJsonVersion && packageJsonVersion.match(/^\d{2}\.\d{2}\.\d+(\.\d+)?$/)) {
    // Use YY.MM from package.json
    const [pkgYear, pkgMonth] = packageJsonVersion.split('.');
    const packageYearMonth = `${pkgYear}.${pkgMonth}`;
    
    // Check if auto month update is enabled and current month is newer
    if (options.autoUpdateMonth && currentYearMonth > packageYearMonth) {
      targetYearMonth = currentYearMonth;
      isAutoMonthUpdate = true;
      console.log(`Auto month update enabled: ${packageYearMonth} → ${targetYearMonth}`);
    } else {
      targetYearMonth = packageYearMonth;
      console.log(`Using YY.MM from package.json: ${targetYearMonth}`);
    }
    
    // Check for manual month bump (when package.json is manually changed)
    if (!isAutoMonthUpdate && existingTags.length > 0) {
      const latestTag = existingTags[0];
      const [latestYear, latestMonth] = latestTag.split('.');
      const latestYearMonth = `${latestYear}.${latestMonth}`;
      
      if (targetYearMonth !== latestYearMonth) {
        isManualBump = true;
        console.log(`Manual month bump detected: ${latestYearMonth} → ${targetYearMonth}`);
      }
    }
  } else {
    // Fall back to current date
    targetYearMonth = currentYearMonth;
    console.log(`Using current date for YY.MM: ${targetYearMonth}`);
  }
  
  // Find tags for target month (filter by format)
  const currentMonthTags = existingTags
    .filter(tag => tag.startsWith(targetYearMonth))
    .filter(tag => {
      const parts = tag.split('.');
      if (isNpmCompatible) {
        return parts.length === 3; // 3-part format only
      } else {
        return parts.length === 4; // 4-part format only
      }
    });
  
  if (currentMonthTags.length === 0 || isManualBump || isAutoMonthUpdate) {
    // First release, manual bump, or auto month update
    const newVersion = isNpmCompatible ? `${targetYearMonth}.1` : `${targetYearMonth}.0.1`;
    const reason = isAutoMonthUpdate ? 'Auto month update' : isManualBump ? 'Manual month bump' : 'First release this month';
    console.log(`${reason}: ${newVersion}`);
    return newVersion;
  }
  
  // Increment existing based on release type and format
  const latestTag = currentMonthTags[0];
  console.log(`Latest tag for ${targetYearMonth}: ${latestTag}`);
  
  if (isNpmCompatible) {
    // 3-part format: YY.MM.PATCH
    const [, , patch] = latestTag.split('.').map(Number);
    const newVersion = `${targetYearMonth}.${patch + 1}`;
    console.log(`Incremented patch: ${newVersion}`);
    return newVersion;
  } else {
    // 4-part format: YY.MM.MINOR.PATCH
    const [, , minor, patch] = latestTag.split('.').map(Number);
    
    let newMinor = minor;
    let newPatch = patch;
    
    if (releaseType === 'minor' || releaseType === 'major') {
      newMinor += 1;
      newPatch = 1;
    } else {
      newPatch += 1;
    }
    
    const newVersion = `${targetYearMonth}.${newMinor}.${newPatch}`;
    console.log(`Incremented ${releaseType}: ${newVersion}`);
    return newVersion;
  }
}

// Determine version format based on options and plugin configuration
function determineVersionFormat(options = {}) {
  // If explicitly set, use that
  if (options.versionFormat && options.versionFormat !== 'auto') {
    return options.versionFormat;
  }
  
  // Auto-detect based on plugins
  if (options.plugins) {
    const hasNpmPlugin = options.plugins.some(plugin => {
      if (typeof plugin === 'string') {
        return plugin.includes('npm');
      } else if (Array.isArray(plugin)) {
        return plugin[0].includes('npm');
      } else if (plugin && typeof plugin === 'object' && plugin.path) {
        return plugin.path.includes('npm');
      }
      return false;
    });
    
    if (hasNpmPlugin) {
      console.log('NPM plugin detected, using 3-part version format for NPM compatibility');
      return 'YY.MM.PATCH';
    }
  }
  
  // Default to 4-part format for full CalVer support
  return 'YY.MM.MINOR.PATCH';
}

// Generate release notes from commits
function generateReleaseNotes(analysis, version, packageName = null) {
  const date = new Date().toISOString().split('T')[0];
  const title = packageName ? `${packageName} [${version}]` : `[${version}]`;
  let notes = `## ${title} - ${date}\n\n`;
  
  if (analysis.hasBreakingChange) {
    notes += `### 💥 BREAKING CHANGES\n`;
    const breakingCommits = analysis.releaseCommits.filter(c => c.includes('💥'));
    breakingCommits.forEach(commit => {
      const msg = commit.replace('💥 ', '');
      notes += `- ${msg}\n`;
    });
    notes += '\n';
  }
  
  const features = analysis.releaseCommits.filter(c => c.includes('✨'));
  if (features.length > 0) {
    notes += `### ✨ Features\n`;
    features.forEach(commit => {
      const msg = commit.replace('✨ ', '');
      notes += `- ${msg}\n`;
    });
    notes += '\n';
  }
  
  const fixes = analysis.releaseCommits.filter(c => c.includes('🐛'));
  if (fixes.length > 0) {
    notes += `### 🐛 Bug Fixes\n`;
    fixes.forEach(commit => {
      const msg = commit.replace('🐛 ', '');
      notes += `- ${msg}\n`;
    });
    notes += '\n';
  }
  
  const performance = analysis.releaseCommits.filter(c => c.includes('⚡'));
  if (performance.length > 0) {
    notes += `### ⚡ Performance Improvements\n`;
    performance.forEach(commit => {
      const msg = commit.replace('⚡ ', '');
      notes += `- ${msg}\n`;
    });
    notes += '\n';
  }
  
  return notes.trim();
}

// Update CHANGELOG.md
function updateChangelog(releaseNotes, packagePath = '.') {
  const changelogPath = path.join(packagePath, 'CHANGELOG.md');
  let existingChangelog = '';
  
  if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    existingChangelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }
  
  // Insert new release notes after the main header
  const lines = existingChangelog.split('\n');
  let insertIndex = lines.length;
  
  // Find the first ## heading (release section) or end of main header
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      insertIndex = i;
      break;
    }
    // If we find an empty line after the main header, insert after it
    if (i > 0 && lines[i-1].trim() && lines[i].trim() === '') {
      insertIndex = i + 1;
    }
  }
  
  const newChangelog = [
    ...lines.slice(0, insertIndex),
    releaseNotes,
    '',
    ...lines.slice(insertIndex)
  ].join('\n');
  
  fs.writeFileSync(changelogPath, newChangelog);
  console.log('📝 Updated CHANGELOG.md');
}

// Process a single package release
async function processPackageRelease(pkg, commits, options = {}) {
  console.log(`\n📦 Processing package: ${pkg.name} (${pkg.path})`);
  
  // Analyze commits for this package
  const analysis = analyzeCommits(commits, pkg.path);
  
  if (!analysis || !analysis.shouldRelease) {
    console.log(`❌ No release needed for ${pkg.name} - only non-release commits found`);
    return null;
  }
  
  console.log(`🎯 Release type for ${pkg.name}: ${analysis.releaseType}`);
  if (analysis.hasBreakingChange) {
    console.log(`⚠️  ${pkg.name} contains breaking changes`);
  }
  
  // Generate CalVer version for this package  
  const newVersion = generateCalVerVersion(analysis.releaseType, pkg.path, options);
  
  // Generate release notes for this package
  const packageName = pkg.name === 'root' ? null : pkg.name;
  const releaseNotes = generateReleaseNotes(analysis, newVersion, packageName);
  console.log(`📋 Release Notes for ${pkg.name}:\n${releaseNotes}\n`);
  
  // Update CHANGELOG.md and package.json for this package
  const packageJsonPath = path.join(pkg.path, 'package.json');
  const tagName = packageName ? `v-${newVersion}-${packageName}-release` : `v-${newVersion}`;
  
  if (options.dryRun) {
    console.log(`📝 Dry run: Would update CHANGELOG.md for ${pkg.name}`);
    console.log(`📦 Dry run: Would update ${packageJsonPath} to ${newVersion}`);
    console.log(`🏷️  Dry run: Would create tag ${tagName}`);
  } else {
    updateChangelog(releaseNotes, pkg.path);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`📦 Updating ${packageJsonPath} to version ${newVersion}`);
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`📦 Updated ${packageJsonPath} to ${newVersion}`);
    
    // Create tag for this package
    execSync(`git tag ${tagName}`, { stdio: 'inherit' });
    console.log(`🏷️  Created tag ${tagName}`);
  }
  
  return {
    package: pkg,
    version: newVersion,
    analysis,
    releaseNotes,
    tagName,
    packageName
  };
}

// Placeholder functions for integrations (to be implemented)
async function sendSlackNotification() {
  // Implementation from original release.js
}

async function createGitLabRelease() {
  // Implementation from original release.js  
}

module.exports = {
  detectMonorepoConfig,
  discoverWorkspaces,
  expandGlobPatterns,
  findPackagesInDir,
  getChangedPackages,
  analyzeCommits,
  generateCalVerVersion,
  determineVersionFormat,
  generateReleaseNotes,
  updateChangelog,
  processPackageRelease,
  sendSlackNotification,
  createGitLabRelease
};