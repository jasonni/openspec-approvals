import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const repoRoot = process.env.REPO_ROOT || cwd;
const openspecRoot = process.env.OPENSPEC_ROOT || path.join(cwd, 'openspec');
const changesDir = path.join(openspecRoot, 'changes');
const dbPath = process.env.DB_PATH || path.join(repoRoot, 'data', 'approvals.db');

const owner = process.env.GITHUB_OWNER || '';
const repo = process.env.GITHUB_REPO || '';
const token = process.env.GITHUB_TOKEN || '';
const branch = process.env.GITHUB_BRANCH || 'main';

const errors = [];
const warnings = [];

if (!fs.existsSync(openspecRoot)) {
  errors.push(`OPENSPEC_ROOT does not exist: ${openspecRoot}`);
}

if (fs.existsSync(openspecRoot) && !fs.existsSync(changesDir)) {
  errors.push(`OpenSpec changes directory not found: ${changesDir}`);
}

const configuredGithub = [owner, repo, token].filter(Boolean).length;
if (configuredGithub > 0 && configuredGithub < 3) {
  warnings.push('GitHub sync is partially configured. Set GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN together.');
}

if (configuredGithub === 3 && !branch) {
  warnings.push('GITHUB_BRANCH is empty. Set it to your target branch (for example, main).');
}

console.log('OpenSpec Approvals Doctor');
console.log('=========================');
console.log(`REPO_ROOT: ${repoRoot}`);
console.log(`OPENSPEC_ROOT: ${openspecRoot}`);
console.log(`DB_PATH: ${dbPath}`);
console.log(`GITHUB_SYNC: ${configuredGithub === 3 ? 'enabled' : configuredGithub === 0 ? 'disabled' : 'partial'}`);
console.log(`GITHUB_BRANCH: ${branch}`);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.log('\nErrors:');
  for (const error of errors) {
    console.log(`- ${error}`);
  }
  process.exit(1);
}

console.log('\nDoctor checks passed.');
