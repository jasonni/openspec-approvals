import path from 'node:path';

const cwd = process.cwd();

export const config = {
  repoRoot: process.env.REPO_ROOT ?? cwd,
  openspecRoot: process.env.OPENSPEC_ROOT ?? path.join(cwd, 'openspec'),
  dbPath: process.env.DB_PATH ?? path.join(cwd, 'data', 'approvals.db'),
  githubOwner: process.env.GITHUB_OWNER ?? '',
  githubRepo: process.env.GITHUB_REPO ?? '',
  githubBranch: process.env.GITHUB_BRANCH ?? 'main',
  githubToken: process.env.GITHUB_TOKEN ?? '',
};

export function githubEnabled(): boolean {
  return Boolean(config.githubOwner && config.githubRepo && config.githubToken);
}
