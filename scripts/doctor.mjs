import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ID_RE = /^[A-Za-z0-9_-]+$/;

const cwd = process.cwd();
const repoRoot = process.env.REPO_ROOT || cwd;
const dbPath = process.env.DB_PATH || path.join(repoRoot, 'data', 'approvals.db');

function parseProjects() {
  const raw = process.env.OPENSPEC_PROJECTS || '';
  if (raw.trim()) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse OPENSPEC_PROJECTS JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('OPENSPEC_PROJECTS must be a non-empty JSON array.');
    }
    return parsed.map((item) => ({
      id: typeof item?.id === 'string' ? item.id.trim() : '',
      name: typeof item?.name === 'string' ? item.name.trim() : '',
      openspecRoot: typeof item?.openspecRoot === 'string' ? path.resolve(item.openspecRoot.trim()) : '',
      githubOwner: typeof item?.githubOwner === 'string' ? item.githubOwner.trim() : '',
      githubRepo: typeof item?.githubRepo === 'string' ? item.githubRepo.trim() : '',
      githubBranch: typeof item?.githubBranch === 'string' && item.githubBranch.trim() ? item.githubBranch.trim() : 'main',
      githubToken: typeof item?.githubToken === 'string' ? item.githubToken.trim() : '',
    }));
  }

  return [
    {
      id: 'default',
      name: 'default',
      openspecRoot: path.resolve(process.env.OPENSPEC_ROOT || path.join(repoRoot, 'openspec')),
      githubOwner: (process.env.GITHUB_OWNER || '').trim(),
      githubRepo: (process.env.GITHUB_REPO || '').trim(),
      githubBranch: (process.env.GITHUB_BRANCH || 'main').trim() || 'main',
      githubToken: (process.env.GITHUB_TOKEN || '').trim(),
    },
  ];
}

const errors = [];
const warnings = [];
let projects = [];

try {
  projects = parseProjects();
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

const seenProjectIds = new Set();
for (const project of projects) {
  if (!project.id || !PROJECT_ID_RE.test(project.id)) {
    errors.push(`Invalid project id: "${project.id}". Use letters, numbers, "_" or "-".`);
    continue;
  }
  if (seenProjectIds.has(project.id)) {
    errors.push(`Duplicate project id: ${project.id}`);
    continue;
  }
  seenProjectIds.add(project.id);

  if (!project.openspecRoot) {
    errors.push(`[${project.id}] openspecRoot is required.`);
    continue;
  }

  const changesDir = path.join(project.openspecRoot, 'changes');
  if (!fs.existsSync(project.openspecRoot)) {
    errors.push(`[${project.id}] OPENSPEC_ROOT does not exist: ${project.openspecRoot}`);
  } else if (!fs.existsSync(changesDir)) {
    errors.push(`[${project.id}] OpenSpec changes directory not found: ${changesDir}`);
  }

  const configuredGithub = [project.githubOwner, project.githubRepo, project.githubToken].filter(Boolean).length;
  if (configuredGithub > 0 && configuredGithub < 3) {
    warnings.push(
      `[${project.id}] GitHub sync is partially configured. Set githubOwner, githubRepo, and githubToken together.`
    );
  }

  if (configuredGithub === 3 && !project.githubBranch) {
    warnings.push(`[${project.id}] githubBranch is empty. Set a target branch (for example, main).`);
  }
}

console.log('OpenSpec Approvals Doctor');
console.log('=========================');
console.log(`REPO_ROOT: ${repoRoot}`);
console.log(`DB_PATH: ${dbPath}`);
console.log(`PROJECT_COUNT: ${projects.length}`);

for (const project of projects) {
  const configuredGithub = [project.githubOwner, project.githubRepo, project.githubToken].filter(Boolean).length;
  const githubStatus = configuredGithub === 3 ? 'enabled' : configuredGithub === 0 ? 'disabled' : 'partial';
  console.log(`\n[${project.id}] ${project.name || project.id}`);
  console.log(`- OPENSPEC_ROOT: ${project.openspecRoot}`);
  console.log(`- GITHUB_SYNC: ${githubStatus}`);
  console.log(`- GITHUB_BRANCH: ${project.githubBranch}`);
}

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
