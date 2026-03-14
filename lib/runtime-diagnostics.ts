import fs from 'node:fs';
import path from 'node:path';
import { listProjects, projectGithubEnabled, requireProject } from '@/lib/projects';

export type DiagnosticLevel = 'error' | 'warning';

export type RuntimeDiagnostic = {
  projectId: string;
  level: DiagnosticLevel;
  code: string;
  message: string;
};

export function getRuntimeDiagnostics(projectId: string): RuntimeDiagnostic[] {
  const project = requireProject(projectId);
  const diagnostics: RuntimeDiagnostic[] = [];

  const changesDir = path.join(project.openspecRoot, 'changes');
  if (!fs.existsSync(project.openspecRoot)) {
    diagnostics.push({
      projectId: project.id,
      level: 'error',
      code: 'OPENSPEC_ROOT_NOT_FOUND',
      message: `OPENSPEC_ROOT does not exist: ${project.openspecRoot}`,
    });
  } else if (!fs.existsSync(changesDir)) {
    diagnostics.push({
      projectId: project.id,
      level: 'error',
      code: 'OPENSPEC_CHANGES_NOT_FOUND',
      message: `OpenSpec changes directory not found: ${changesDir}`,
    });
  }

  const hasGithubOwner = Boolean(project.githubOwner);
  const hasGithubRepo = Boolean(project.githubRepo);
  const hasGithubToken = Boolean(project.githubToken);
  const configuredCount = [hasGithubOwner, hasGithubRepo, hasGithubToken].filter(Boolean).length;

  if (configuredCount > 0 && !projectGithubEnabled(project)) {
    diagnostics.push({
      projectId: project.id,
      level: 'warning',
      code: 'GITHUB_SYNC_PARTIAL_CONFIG',
      message:
        'GitHub sync is partially configured. Set githubOwner, githubRepo, and githubToken together for this project.',
    });
  }

  if (projectGithubEnabled(project) && !project.githubBranch) {
    diagnostics.push({
      projectId: project.id,
      level: 'warning',
      code: 'GITHUB_BRANCH_EMPTY',
      message: 'githubBranch is empty. Set a valid branch name (for example, main).',
    });
  }

  return diagnostics;
}

export function getAllRuntimeDiagnostics(): RuntimeDiagnostic[] {
  return listProjects().flatMap((project) => getRuntimeDiagnostics(project.id));
}
