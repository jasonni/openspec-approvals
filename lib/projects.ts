import path from 'node:path';
import { config } from '@/lib/config';

const PROJECT_ID_RE = /^[A-Za-z0-9_-]+$/;

type RawProject = {
  id?: unknown;
  name?: unknown;
  openspecRoot?: unknown;
  githubOwner?: unknown;
  githubRepo?: unknown;
  githubBranch?: unknown;
  githubToken?: unknown;
};

export type ProjectConfig = {
  id: string;
  name: string;
  openspecRoot: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubToken: string;
};

const globalProjects = globalThis as unknown as {
  cachedProjects?: ProjectConfig[];
  cachedById?: Map<string, ProjectConfig>;
};

function toNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid project field: ${fieldName}`);
  }
  return value.trim();
}

function toOptionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProject(raw: RawProject): ProjectConfig {
  const id = toNonEmptyString(raw.id, 'id');
  if (!PROJECT_ID_RE.test(id)) {
    throw new Error(`Invalid project id "${id}". Use letters, numbers, "_" or "-".`);
  }

  const openspecRoot = path.resolve(toNonEmptyString(raw.openspecRoot, 'openspecRoot'));

  return {
    id,
    name: toOptionalString(raw.name) || id,
    openspecRoot,
    githubOwner: toOptionalString(raw.githubOwner),
    githubRepo: toOptionalString(raw.githubRepo),
    githubBranch: toOptionalString(raw.githubBranch) || 'main',
    githubToken: toOptionalString(raw.githubToken),
  };
}

function parseProjects(): ProjectConfig[] {
  const raw = process.env.OPENSPEC_PROJECTS;
  if (raw && raw.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse OPENSPEC_PROJECTS JSON: ${message}`);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('OPENSPEC_PROJECTS must be a non-empty JSON array.');
    }

    const normalized = parsed.map((entry) => normalizeProject((entry ?? {}) as RawProject));
    const seen = new Set<string>();
    for (const project of normalized) {
      if (seen.has(project.id)) {
        throw new Error(`Duplicate project id in OPENSPEC_PROJECTS: ${project.id}`);
      }
      seen.add(project.id);
    }
    return normalized;
  }

  const openspecRoot = path.resolve(process.env.OPENSPEC_ROOT ?? path.join(config.repoRoot, 'openspec'));
  return [
    {
      id: 'default',
      name: 'default',
      openspecRoot,
      githubOwner: (process.env.GITHUB_OWNER ?? '').trim(),
      githubRepo: (process.env.GITHUB_REPO ?? '').trim(),
      githubBranch: (process.env.GITHUB_BRANCH ?? 'main').trim() || 'main',
      githubToken: (process.env.GITHUB_TOKEN ?? '').trim(),
    },
  ];
}

function ensureProjectCache(): void {
  if (globalProjects.cachedProjects && globalProjects.cachedById) return;
  const projects = parseProjects();
  globalProjects.cachedProjects = projects;
  globalProjects.cachedById = new Map(projects.map((project) => [project.id, project]));
}

export function listProjects(): ProjectConfig[] {
  ensureProjectCache();
  return globalProjects.cachedProjects ?? [];
}

export function isValidProjectId(projectId: string): boolean {
  return PROJECT_ID_RE.test(projectId);
}

export function getProject(projectId: string): ProjectConfig | null {
  ensureProjectCache();
  if (!isValidProjectId(projectId)) return null;
  return globalProjects.cachedById?.get(projectId) ?? null;
}

export function requireProject(projectId: string): ProjectConfig {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`);
  }
  return project;
}

export function projectGithubEnabled(project: ProjectConfig): boolean {
  return Boolean(project.githubOwner && project.githubRepo && project.githubToken);
}

export function approvalFilePath(projectId: string, changeId: string): string {
  return `openspec/approvals/${projectId}/${changeId}.json`;
}
