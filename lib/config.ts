import path from 'node:path';

const cwd = process.cwd();

export const config = {
  repoRoot: process.env.REPO_ROOT ?? cwd,
  dbPath: process.env.DB_PATH ?? path.join(cwd, 'data', 'approvals.db'),
};
