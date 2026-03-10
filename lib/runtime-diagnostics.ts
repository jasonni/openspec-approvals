import fs from 'node:fs';
import path from 'node:path';
import { config, githubEnabled } from '@/lib/config';

export type DiagnosticLevel = 'error' | 'warning';

export type RuntimeDiagnostic = {
  level: DiagnosticLevel;
  code: string;
  message: string;
};

export function getRuntimeDiagnostics(): RuntimeDiagnostic[] {
  const diagnostics: RuntimeDiagnostic[] = [];

  const changesDir = path.join(config.openspecRoot, 'changes');
  if (!fs.existsSync(config.openspecRoot)) {
    diagnostics.push({
      level: 'error',
      code: 'OPENSPEC_ROOT_NOT_FOUND',
      message: `OPENSPEC_ROOT does not exist: ${config.openspecRoot}`,
    });
  } else if (!fs.existsSync(changesDir)) {
    diagnostics.push({
      level: 'error',
      code: 'OPENSPEC_CHANGES_NOT_FOUND',
      message: `OpenSpec changes directory not found: ${changesDir}`,
    });
  }

  const hasGithubOwner = Boolean(config.githubOwner);
  const hasGithubRepo = Boolean(config.githubRepo);
  const hasGithubToken = Boolean(config.githubToken);
  const configuredCount = [hasGithubOwner, hasGithubRepo, hasGithubToken].filter(Boolean).length;

  if (configuredCount > 0 && !githubEnabled()) {
    diagnostics.push({
      level: 'warning',
      code: 'GITHUB_SYNC_PARTIAL_CONFIG',
      message:
        'GitHub sync is partially configured. Set GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN together to enable sync.',
    });
  }

  if (githubEnabled() && !config.githubBranch) {
    diagnostics.push({
      level: 'warning',
      code: 'GITHUB_BRANCH_EMPTY',
      message: 'GITHUB_BRANCH is empty. Set a valid branch name (for example, main).',
    });
  }

  return diagnostics;
}
