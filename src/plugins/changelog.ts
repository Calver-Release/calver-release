const { updateChangelog } = require('../release-core');
import { Plugin, CalverReleaseContext, PluginFactory } from '../types';

/**
 * Built-in changelog plugin
 */
const createChangelogPlugin: PluginFactory = (options: any = {}): Plugin => {
  return {
    prepare: async (ctx: CalverReleaseContext): Promise<void> => {
      const { logger, nextRelease, options } = ctx;
      
      // Skip changelog updates in dry-run mode
      if (options?.dryRun) {
        logger?.log('Dry run: Skipping changelog update');
        return;
      }
      
      logger?.log('Updating changelog...');
      
      if (nextRelease?.type === 'multi' && nextRelease.releases) {
        // Update changelog for each package
        for (const release of nextRelease.releases) {
          const notes = release.releaseNotes || '';
          updateChangelog(notes, release.package.path);
        }
      } else if (nextRelease) {
        // Single package
        const packagePath = (nextRelease as any).package?.path || '.';
        updateChangelog(nextRelease.notes || '', packagePath);
      }
    }
  };
};

export default createChangelogPlugin;