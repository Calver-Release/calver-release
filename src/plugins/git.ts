import { execSync } from 'child_process';
import { Plugin, CalverReleaseContext, PluginResult, PluginFactory } from '../types';

/**
 * Built-in git plugin - creates tags and commits
 */
const createGitPlugin: PluginFactory = (options: any = {}): Plugin => {
  return {
    prepare: async (ctx: CalverReleaseContext): Promise<void> => {
      const { logger, nextRelease } = ctx;
      
      // Configure git user if needed
      configureGitUser();
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        // Create tags for each package
        for (const release of nextRelease.releases) {
          execSync(`git tag ${release.tagName}`, { stdio: 'inherit' });
          logger?.log(`Created tag ${release.tagName}`);
        }
      } else if (nextRelease) {
        // Single package tag
        const tagName = (nextRelease as any).tagName || (nextRelease as any).gitTag;
        execSync(`git tag ${tagName}`, { stdio: 'inherit' });
        logger?.log(`Created tag ${tagName}`);
      }
    },
    
    publish: async (ctx: CalverReleaseContext): Promise<PluginResult> => {
      const { logger, nextRelease } = ctx;
      
      // Commit changes
      const filesToAdd = getFilesToCommit(nextRelease);
      
      if (filesToAdd.length > 0) {
        execSync(`git add ${filesToAdd.join(' ')}`, { stdio: 'inherit' });
        
        const commitMessage = getCommitMessage(nextRelease);
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
        logger?.log('Committed release files');
      }
      
      // Push changes and tags
      const isCI = process.env.CI || process.env.GITLAB_CI;
      const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      
      if (isCI) {
        const targetBranch = process.env.CI_COMMIT_REF_NAME || currentBranch;
        try {
          execSync(`git push origin HEAD:${targetBranch}`, { stdio: 'inherit' });
          logger?.log(`Pushed changes to ${targetBranch}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger?.error(`Failed to push to ${targetBranch}: ${errorMessage}`);
        }
      } else {
        try {
          execSync(`git push origin ${currentBranch}`, { stdio: 'inherit' });
          logger?.log(`Pushed changes to ${currentBranch}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger?.error(`Failed to push to ${currentBranch}: ${errorMessage}`);
        }
      }
      
      // Push tags
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        for (const release of nextRelease.releases) {
          try {
            execSync(`git push origin ${release.tagName}`, { stdio: 'inherit' });
            logger?.log(`Pushed tag ${release.tagName}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger?.error(`Failed to push tag ${release.tagName}: ${errorMessage}`);
          }
        }
      } else if (nextRelease) {
        const tagName = (nextRelease as any).tagName || (nextRelease as any).gitTag;
        try {
          execSync(`git push origin ${tagName}`, { stdio: 'inherit' });
          logger?.log(`Pushed tag ${tagName}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger?.error(`Failed to push tag ${tagName}: ${errorMessage}`);
        }
      }
      
      const gitTag = nextRelease?.type === 'multi' ? 
        nextRelease.releases?.[0]?.tagName || 'multi-release' :
        (nextRelease as any)?.tagName || (nextRelease as any)?.gitTag || 'release';
      
      return { type: 'git', gitTag };
    }
  };
};

function configureGitUser(): void {
  try {
    execSync('git config user.email', { stdio: 'ignore' });
  } catch (error) {
    const email = process.env.GITLAB_USER_EMAIL || process.env.CI_COMMIT_AUTHOR_EMAIL || 'release-bot@example.com';
    const name = process.env.GITLAB_USER_NAME || process.env.CI_COMMIT_AUTHOR || 'Release Bot';
    execSync(`git config user.email "${email}"`, { stdio: 'inherit' });
    execSync(`git config user.name "${name}"`, { stdio: 'inherit' });
  }
}

function getFilesToCommit(nextRelease: any): string[] {
  const files: string[] = [];
  
  if (nextRelease?.type === 'multi' && nextRelease.releases) {
    for (const release of nextRelease.releases) {
      files.push(
        `${release.package.path}/CHANGELOG.md`,
        `${release.package.path}/package.json`
      );
    }
  } else if (nextRelease) {
    const packagePath = nextRelease.package?.path || '.';
    files.push(
      `${packagePath}/CHANGELOG.md`,
      `${packagePath}/package.json`
    );
  }
  
  return files;
}

function getCommitMessage(nextRelease: any): string {
  if (nextRelease?.type === 'multi' && nextRelease.releases) {
    return `chore(release): ${nextRelease.releases.length} packages [skip ci]`;
  } else if (nextRelease) {
    const packageName = nextRelease.packageName || 'root';
    return `chore(release): ${packageName}@${nextRelease.version} [skip ci]`;
  }
  
  return 'chore(release): automated release [skip ci]';
}

export default createGitPlugin;