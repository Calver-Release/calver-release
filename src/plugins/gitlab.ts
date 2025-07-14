import * as https from 'https';
import { Plugin, CalverReleaseContext, PluginResult, PluginFactory } from '../types';

/**
 * Built-in GitLab plugin - creates GitLab releases
 */
const createGitLabPlugin: PluginFactory = (options: any = {}): Plugin => {
  return {
    publish: async (ctx: CalverReleaseContext): Promise<PluginResult | PluginResult[]> => {
      const { logger, nextRelease } = ctx;
      
      const gitlabToken = process.env.GITLAB_ACCESS_TOKEN || process.env.CI_JOB_TOKEN;
      const projectId = process.env.CI_PROJECT_ID;
      const gitlabHost = process.env.CI_SERVER_HOST || 'gitlab.com';
      
      if (!gitlabToken || !projectId) {
        logger?.log('Skipping GitLab release - missing token or project ID');
        return [];
      }
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        // Create release for each package
        const releases: PluginResult[] = [];
        for (const release of nextRelease.releases) {
          const result = await createGitLabRelease(
            release.tagName,
            release.packageName || 'root',
            nextRelease.notes || '',
            gitlabToken,
            projectId,
            gitlabHost
          );
          releases.push(result);
        }
        return releases;
      } else if (nextRelease) {
        // Single release
        const tagName = (nextRelease as any).tagName || (nextRelease as any).gitTag;
        const packageName = (nextRelease as any).packageName || 'root';
        return await createGitLabRelease(
          tagName,
          packageName,
          nextRelease.notes || '',
          gitlabToken,
          projectId,
          gitlabHost
        );
      }
      
      return [];
    }
  };
};

async function createGitLabRelease(
  tagName: string,
  releaseName: string,
  description: string,
  token: string,
  projectId: string,
  host: string
): Promise<PluginResult> {
  return new Promise((resolve, reject) => {
    const payload = {
      tag_name: tagName,
      name: `${releaseName} ${tagName}`,
      description: description
    };
    
    const data = JSON.stringify(payload);
    
    const options: https.RequestOptions = {
      hostname: host,
      port: 443,
      path: `/api/v4/projects/${projectId}/releases`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
        'PRIVATE-TOKEN': token,
        'User-Agent': 'CalVer-Release/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve({ 
            type: 'gitlab', 
            url: `https://${host}/${projectId}/-/releases/${tagName}`,
            id: tagName
          });
        } else {
          reject(new Error(`GitLab release failed: ${res.statusCode} ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`GitLab release error: ${error.message}`));
    });
    
    req.write(data);
    req.end();
  });
}

export default createGitLabPlugin;