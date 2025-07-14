import { MonorepoConfig, Package, CommitAnalysis } from './types';

export function detectMonorepoConfig(): MonorepoConfig;
export function discoverWorkspaces(monorepoConfig: MonorepoConfig): Package[];
export function getChangedPackages(packages: Package[], commits: string): Package[];
export function analyzeCommits(commitMessages: string, packagePath?: string): CommitAnalysis | null;
export function generateCalVerVersion(releaseType: 'major' | 'minor' | 'patch', packagePath?: string, options?: any): string;
export function generateReleaseNotes(analysis: CommitAnalysis, version: string, packageName?: string | null): string;
export function updateChangelog(releaseNotes: string, packagePath?: string): void;
export function processPackageRelease(pkg: Package, commits: string, options?: any): any;