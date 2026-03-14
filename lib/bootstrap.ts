import { getDb } from '@/lib/db';
import { processSyncJobs } from '@/lib/github-sync';
import { reindexAll, startWatcher } from '@/lib/openspec';

const globalBoot = globalThis as unknown as {
  bootedProjects?: Set<string>;
  syncTimer?: NodeJS.Timeout;
};

export function ensureProjectBootstrapped(projectId: string): void {
  if (!globalBoot.bootedProjects) {
    globalBoot.bootedProjects = new Set();
  }

  if (!globalBoot.bootedProjects.has(projectId)) {
    getDb();
    reindexAll(projectId);
    startWatcher(projectId);
    globalBoot.bootedProjects.add(projectId);
  }

  if (!globalBoot.syncTimer) {
    globalBoot.syncTimer = setInterval(() => {
      processSyncJobs().catch(() => {
        // no-op, status is captured in sync_jobs and approvals
      });
    }, 5000);
  }
}

export function isProjectBootstrapped(projectId: string): boolean {
  return globalBoot.bootedProjects?.has(projectId) ?? false;
}
