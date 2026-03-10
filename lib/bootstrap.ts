import { getDb } from '@/lib/db';
import { processSyncJobs } from '@/lib/github-sync';
import { reindexAll, startWatcher } from '@/lib/openspec';

const globalBoot = globalThis as unknown as { booted?: boolean; syncTimer?: NodeJS.Timeout };

export function ensureBootstrapped(): void {
  if (globalBoot.booted) return;

  getDb();
  reindexAll();
  startWatcher();

  globalBoot.syncTimer = setInterval(() => {
    processSyncJobs().catch(() => {
      // no-op, status is captured in sync_jobs and approvals
    });
  }, 5000);

  globalBoot.booted = true;
}
