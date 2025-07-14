#!/usr/bin/env node

import calverRelease from '../src/index';
import { program } from 'commander';
import * as packageJson from '../package.json';

program
  .name('calver-release')
  .description('Fully automated CalVer releases - semantic-release alternative')
  .version(packageJson.version);

// Main command (like semantic-release)
program
  .argument('[options]', 'Release options')
  .option('-d, --dry-run', 'Skip publishing, only verify release is viable and show preview')
  .option('-b, --branches <branches>', 'Git branches to release from', 'main,master')
  .option('--debug', 'Enable debug mode')
  .option('--no-ci', 'Skip CI verification')
  .option('-e, --extends <config>', 'Shareable configuration to extend')
  .action(async (argumentValue: any, options: any) => {
    try {
      // Parse branches
      if (options.branches) {
        options.branches = options.branches.split(',').map((b: string) => b.trim());
      }
      
      console.log('🚀 CalVer Release');
      console.log('===============');
      
      const result = await calverRelease(options);
      
      if (result.released) {
        console.log('\\n✅ Release completed successfully!');
        if (result.nextRelease?.type === 'multi') {
          console.log(`Released ${result.nextRelease.releases?.length} packages:`);
          result.nextRelease.releases?.forEach(release => {
            console.log(`  • ${release.name}: ${release.version}`);
          });
        } else {
          console.log(`Released: ${result.nextRelease?.name}@${result.nextRelease?.version}`);
        }
      } else if (result.dryRun) {
        console.log('\\n🧪 Dry run completed');
        if (result.nextRelease) {
          console.log('Would release:', result.nextRelease.version);
        }
      } else {
        console.log('\\n📋 No release necessary');
      }
      
      process.exit(0);
    } catch (error: any) {
      console.error('\\n❌ Release failed:', error.message);
      if (options.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Additional commands for compatibility
program
  .command('exec')
  .description('Execute calver-release programmatically')
  .action(() => {
    console.log("Use: npx calver-release or require('calver-release')()");
  });

// Help improvements
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ calver-release                    # Run release process');
  console.log('  $ calver-release --dry-run          # Preview without releasing');
  console.log('  $ calver-release --debug            # Debug mode');
  console.log('  $ calver-release --branches main    # Release from main branch only');
  console.log('');
  console.log('Configuration:');
  console.log('  Create .calver-releaserc.json, package.json "calver-release" field,');
  console.log('  or calver-release.config.js for advanced configuration.');
  console.log('');
  console.log('Environment Variables:');
  console.log('  GITLAB_ACCESS_TOKEN    GitLab API token');
  console.log('  CI_PROJECT_ID          GitLab project ID');
  console.log('  GITHUB_TOKEN           GitHub API token');
  console.log('  SLACK_WEBHOOK_URL      Slack webhook for notifications');
  console.log('');
});

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);