const { analyzeCommits } = require('../release-core');
import { Plugin, CalverReleaseContext, CommitAnalysis, PluginFactory } from '../types';

/**
 * Built-in commit analyzer plugin
 * Analyzes commits using conventional commit format
 */
const createCommitAnalyzer: PluginFactory = (options: any = {}): Plugin => {
  return {
    analyzeCommits: async (ctx: CalverReleaseContext): Promise<CommitAnalysis | null> => {
      const { logger } = ctx;
      
      logger?.log('Analyzing commits...');
      
      // This would be called by the main flow
      // The actual analysis is done in the main analyzeStep function
      return null;
    }
  };
};

export default createCommitAnalyzer;