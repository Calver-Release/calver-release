const { generateReleaseNotes } = require('../release-core');
import { Plugin, CalverReleaseContext, PluginFactory } from '../types';

/**
 * Built-in release notes generator plugin
 */
const createReleaseNotesGenerator: PluginFactory = (options: any = {}): Plugin => {
  return {
    generateNotes: async (ctx: CalverReleaseContext): Promise<string> => {
      const { logger, nextRelease } = ctx;
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        // Generate notes for multi-package release
        const notes = nextRelease.releases.map(release => {
          return generateReleaseNotes(release.analysis, release.version, release.packageName);
        });
        
        return notes.join('\\n\\n---\\n\\n');
      } else if (nextRelease && (nextRelease as any).analysis) {
        // Single package release
        return generateReleaseNotes(
          (nextRelease as any).analysis, 
          (nextRelease as any).version, 
          (nextRelease as any).packageName
        );
      }
      
      return '';
    }
  };
};

export default createReleaseNotesGenerator;