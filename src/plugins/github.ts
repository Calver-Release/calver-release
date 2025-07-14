import * as https from 'https';
import { execSync } from 'child_process';
import { Plugin, CalverReleaseContext, PluginResult, PluginFactory } from '../types';

interface RepositoryInfo {
  owner: string;
  repo: string;
}

interface GitHubRelease {
  html_url: string;
  id: number;
  tag_name: string;
}

/**
 * Built-in GitHub plugin - creates GitHub releases
 */
const createGitHubPlugin: PluginFactory = (options: any = {}): Plugin => {
  return {
    verifyConditions: async (ctx: CalverReleaseContext): Promise<void> => {
      const { logger, options } = ctx;
      
      // Skip token check in dry-run mode
      if (options?.dryRun) {
        logger?.log('Dry run mode - GitHub token check skipped');
        return;
      }
      
      const githubToken = process.env.GITHUB_TOKEN;
      
      if (!githubToken) {
        throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable.');
      }
      
      // Verify this is a GitHub repository
      try {
        const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
        if (!remoteUrl.includes('github.com')) {
          logger?.log('Skipping GitHub release - not a GitHub repository');
          return;
        }
      } catch (error) {
        throw new Error('Could not determine repository URL');
      }
    },
    
    publish: async (ctx: CalverReleaseContext): Promise<PluginResult | PluginResult[]> => {
      const { logger, nextRelease, options } = ctx;
      
      // Skip publishing in dry-run mode
      if (options?.dryRun) {
        logger?.log('Dry run mode - GitHub release creation skipped');
        return [];
      }
      
      const githubToken = process.env.GITHUB_TOKEN;
      
      if (!githubToken) {
        logger?.log('Skipping GitHub release - missing GITHUB_TOKEN');
        return [];
      }
      
      // Get repository info from git remote
      const repoInfo = getRepositoryInfo();
      if (!repoInfo) {
        logger?.log('Skipping GitHub release - could not determine repository info');
        return [];
      }
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        // Create release for each package
        const releases: PluginResult[] = [];
        for (const release of nextRelease.releases) {
          const result = await createGitHubRelease(
            repoInfo.owner,
            repoInfo.repo,
            release.tagName,
            release.packageName || 'root',
            nextRelease.notes || '',
            githubToken,
            release.analysis.hasBreakingChange
          );
          releases.push(result);
          logger?.log(`Created GitHub release for ${release.packageName || 'root'}: ${result.url}`);
        }
        return releases;
      } else if (nextRelease) {
        // Single release
        const result = await createGitHubRelease(
          repoInfo.owner,
          repoInfo.repo,
          (nextRelease as any).tagName || (nextRelease as any).gitTag,
          (nextRelease as any).packageName || 'root',
          nextRelease.notes || '',
          githubToken,
          (nextRelease as any).analysis?.hasBreakingChange || false
        );
        logger?.log(`Created GitHub release: ${result.url}`);
        return result;
      }
      
      return [];
    }
  };
};

function getRepositoryInfo(): RepositoryInfo | null {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    
    // Parse GitHub URL
    let match: RegExpMatchArray | null = null;
    if (remoteUrl.startsWith('https://github.com/')) {
      // HTTPS URL: https://github.com/owner/repo.git
      match = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    } else if (remoteUrl.startsWith('git@github.com:')) {
      // SSH URL: git@github.com:owner/repo.git
      match = remoteUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/);
    }
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function createGitHubRelease(
  owner: string, 
  repo: string, 
  tagName: string, 
  releaseName: string, 
  description: string, 
  token: string, 
  isPrerelease: boolean = false
): Promise<PluginResult> {
  return new Promise((resolve, reject) => {
    const payload = {
      tag_name: tagName,
      name: `${releaseName} ${tagName}`,
      body: description,
      draft: false,
      prerelease: isPrerelease,
      generate_release_notes: false
    };
    
    const data = JSON.stringify(payload);
    
    const options: https.RequestOptions = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${owner}/${repo}/releases`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
        'Authorization': `token ${token}`,
        'User-Agent': 'CalVer-Release/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201) {
          const release: GitHubRelease = JSON.parse(responseData);
          resolve({ 
            type: 'github', 
            url: release.html_url,
            id: release.id.toString(),
            tagName: release.tag_name
          });
        } else {
          try {
            const errorData = JSON.parse(responseData);
            reject(new Error(`GitHub release failed: ${res.statusCode} - ${errorData.message}`));
          } catch (e) {
            reject(new Error(`GitHub release failed: ${res.statusCode} ${responseData}`));
          }
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`GitHub release error: ${error.message}`));
    });
    
    req.write(data);
    req.end();
  });
}

export default createGitHubPlugin;