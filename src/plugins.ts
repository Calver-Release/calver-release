import * as fs from 'fs';
import * as path from 'path';
import { Plugin, PluginDefinition, PluginCollection, CalverReleaseContext, Config, PluginFactory } from './types';

// Built-in plugins - all TypeScript now
import commitAnalyzer from './plugins/commit-analyzer';
import releaseNotesGenerator from './plugins/release-notes-generator';
import githubPlugin from './plugins/github';
import changelogPlugin from './plugins/changelog';
import npmPlugin from './plugins/npm';
import gitPlugin from './plugins/git';
import gitlabPlugin from './plugins/gitlab';

// Built-in plugins registry
const builtinPlugins: Record<string, PluginFactory> = {
  '@calver-release/commit-analyzer': commitAnalyzer,
  '@calver-release/release-notes-generator': releaseNotesGenerator,
  '@calver-release/changelog': changelogPlugin,
  '@calver-release/npm': npmPlugin,
  '@calver-release/git': gitPlugin,
  '@calver-release/gitlab': gitlabPlugin,
  '@calver-release/github': githubPlugin
};

/**
 * Load and organize plugins by lifecycle step
 */
export async function getPlugins(config: Config, context: CalverReleaseContext): Promise<PluginCollection> {
  const plugins: PluginCollection = {
    verifyConditions: [],
    analyzeCommits: [],
    verifyRelease: [],
    generateNotes: [],
    prepare: [],
    publish: [],
    success: [],
    fail: []
  };
  
  for (const pluginConfig of config.plugins) {
    const plugin = await loadPlugin(pluginConfig, context);
    
    // Add plugin to appropriate lifecycle steps
    if (plugin.verifyConditions) plugins.verifyConditions.push(plugin.verifyConditions.bind(plugin));
    if (plugin.analyzeCommits) plugins.analyzeCommits.push(plugin.analyzeCommits.bind(plugin));
    if (plugin.verifyRelease) plugins.verifyRelease.push(plugin.verifyRelease.bind(plugin));
    if (plugin.generateNotes) plugins.generateNotes.push(plugin.generateNotes.bind(plugin));
    if (plugin.prepare) plugins.prepare.push(plugin.prepare.bind(plugin));
    if (plugin.publish) plugins.publish.push(plugin.publish.bind(plugin));
    if (plugin.success) plugins.success.push(plugin.success.bind(plugin));
    if (plugin.fail) plugins.fail.push(plugin.fail.bind(plugin));
  }
  
  return plugins;
}

/**
 * Load a single plugin
 */
export async function loadPlugin(pluginConfig: PluginDefinition, context: CalverReleaseContext): Promise<Plugin> {
  let pluginName: string;
  let pluginOptions: any = {};
  
  if (typeof pluginConfig === 'string') {
    pluginName = pluginConfig;
  } else if (Array.isArray(pluginConfig)) {
    [pluginName, pluginOptions] = pluginConfig;
  } else if (typeof pluginConfig === 'object') {
    pluginName = pluginConfig.path;
    pluginOptions = pluginConfig.options || {};
  } else {
    throw new Error(`Invalid plugin configuration: ${pluginConfig}`);
  }
  
  // Try to load built-in plugin first
  if (builtinPlugins[pluginName]) {
    const pluginFactory = builtinPlugins[pluginName];
    return pluginFactory(pluginOptions);
  }
  
  // Try to load external plugin
  try {
    const plugin = require(pluginName);
    return typeof plugin === 'function' ? plugin(pluginOptions) : plugin;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load plugin "${pluginName}": ${errorMessage}`);
  }
}

export { builtinPlugins };