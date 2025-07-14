export interface MonorepoConfig {
  type: 'single' | 'lerna' | 'nx' | 'pnpmWorkspace' | 'npmWorkspaces';
  configFile?: string;
  workspaces?: string[] | { packages: string[] };
}

export interface CalverReleaseOptions {
  dryRun?: boolean;
  verbose?: boolean;
  debug?: boolean;
  branches?: string[];
  tagFormat?: string;
  plugins?: PluginDefinition[];
  ci?: boolean;
  repositoryUrl?: string;
  tagName?: string;
  autoUpdateMonth?: boolean;
}

export interface Package {
  name: string;
  path: string;
  packageJson: string;
}

export interface CommitAnalysis {
  shouldRelease: boolean;
  releaseType: 'major' | 'minor' | 'patch';
  hasBreakingChange: boolean;
  hasFeature: boolean;
  hasFix: boolean;
  releaseCommits: string[];
}

export interface NextRelease {
  type?: 'single' | 'multi';
  version?: string;
  name?: string;
  analysis?: CommitAnalysis;
  notes?: string;
  releases?: ReleaseResult[];
}

export interface ReleaseResult {
  package: Package;
  version: string;
  analysis: CommitAnalysis;
  releaseNotes: string;
  tagName: string;
  packageName: string | null;
  name?: string;
}

export interface Logger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  success: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
}

export interface CalverReleaseContext {
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdout?: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
  logger?: Logger;
  options?: CalverReleaseOptions;
  nextRelease?: NextRelease;
  packages?: Package[];
}

export interface PluginResult {
  type?: string;
  url?: string;
  id?: string;
  [key: string]: any;
}

// Plugin Interface - All methods are optional
export interface Plugin {
  verifyConditions?: (ctx: CalverReleaseContext) => Promise<void> | void;
  analyzeCommits?: (ctx: CalverReleaseContext) => Promise<CommitAnalysis | null> | CommitAnalysis | null;
  verifyRelease?: (ctx: CalverReleaseContext) => Promise<void> | void;
  generateNotes?: (ctx: CalverReleaseContext) => Promise<string> | string;
  prepare?: (ctx: CalverReleaseContext) => Promise<void> | void;
  publish?: (ctx: CalverReleaseContext) => Promise<PluginResult | PluginResult[]> | PluginResult | PluginResult[];
  success?: (ctx: CalverReleaseContext) => Promise<void> | void;
  fail?: (ctx: CalverReleaseContext, error: Error) => Promise<void> | void;
}

// Plugin factory function type
export type PluginFactory = (options?: any) => Plugin;

// Plugin definition can be string, array, or object
export type PluginDefinition = 
  | string
  | [string, any]
  | { path: string; options?: any };

export interface PluginCollection {
  verifyConditions: Array<(ctx: CalverReleaseContext) => Promise<void> | void>;
  analyzeCommits: Array<(ctx: CalverReleaseContext) => Promise<CommitAnalysis | null> | CommitAnalysis | null>;
  verifyRelease: Array<(ctx: CalverReleaseContext) => Promise<void> | void>;
  generateNotes: Array<(ctx: CalverReleaseContext) => Promise<string> | string>;
  prepare: Array<(ctx: CalverReleaseContext) => Promise<void> | void>;
  publish: Array<(ctx: CalverReleaseContext) => Promise<PluginResult | PluginResult[]> | PluginResult | PluginResult[]>;
  success: Array<(ctx: CalverReleaseContext) => Promise<void> | void>;
  fail: Array<(ctx: CalverReleaseContext, error: Error) => Promise<void> | void>;
}

export interface CalverReleaseResult {
  released: boolean;
  dryRun?: boolean;
  nextRelease?: NextRelease;
  releases?: ReleaseResult[];
}

export interface Config extends CalverReleaseOptions {
  plugins: PluginDefinition[];
  tagFormat: string;
  repositoryUrl: string;
  branches: string[];
}

// Abstract base class for easier plugin development
export abstract class BasePlugin implements Plugin {
  protected options: any;

  constructor(options: any = {}) {
    this.options = options;
  }

  // Default implementations that can be overridden
  async verifyConditions?(ctx: CalverReleaseContext): Promise<void> {}
  async analyzeCommits?(ctx: CalverReleaseContext): Promise<CommitAnalysis | null> { return null; }
  async verifyRelease?(ctx: CalverReleaseContext): Promise<void> {}
  async generateNotes?(ctx: CalverReleaseContext): Promise<string> { return ''; }
  async prepare?(ctx: CalverReleaseContext): Promise<void> {}
  async publish?(ctx: CalverReleaseContext): Promise<PluginResult | PluginResult[]> { return []; }
  async success?(ctx: CalverReleaseContext): Promise<void> {}
  async fail?(ctx: CalverReleaseContext, error: Error): Promise<void> {}
}

// Utility types for plugin development
export type PluginStep = keyof Plugin;
export type AsyncPluginMethod<T extends PluginStep> = Plugin[T] extends 
  (...args: any[]) => Promise<infer R> | infer R ? R : never;