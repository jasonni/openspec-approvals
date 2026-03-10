import { config, githubEnabled } from '@/lib/config';
import {
  listApprovals,
  listPendingSyncJobs,
  markApprovalsFailed,
  markApprovalsSynced,
  updateSyncJob,
} from '@/lib/db';
import { events } from '@/lib/events';

const globalWorker = globalThis as unknown as { processingSync?: boolean };

type GithubContentResponse = {
  sha?: string;
  content?: string;
  message?: string;
};

async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init?.headers,
    },
  });

  const data = (await res.json()) as T;
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function readRemoteApprovalFile(changeId: string): Promise<{ sha?: string; events: unknown[] }> {
  const filePath = `openspec/approvals/${changeId}.json`;
  try {
    const data = await githubRequest<GithubContentResponse>(
      `/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodeURIComponent(filePath)}?ref=${config.githubBranch}`
    );
    if (!data.content) {
      return { sha: data.sha, events: [] };
    }
    const decoded = Buffer.from(data.content, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as { events?: unknown[] };
    return { sha: data.sha, events: parsed.events ?? [] };
  } catch {
    return { events: [] };
  }
}

function dedupeEvents(events: Array<{ id: string }>): Array<{ id: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string }> = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

async function syncChangeToGithub(changeId: string): Promise<void> {
  if (!githubEnabled()) {
    markApprovalsSynced(changeId);
    return;
  }

  const localEvents = listApprovals(changeId).map((e) => ({
    id: e.id,
    changeId: e.changeId,
    artifactType: e.artifactType,
    decision: e.decision,
    comment: e.comment,
    reviewer: e.reviewer,
    createdAt: e.createdAt,
  }));

  const remote = await readRemoteApprovalFile(changeId);
  const merged = dedupeEvents([
    ...(remote.events as Array<{ id: string; createdAt?: string }>),
    ...localEvents,
  ]).sort((a, b) => {
    const aa = 'createdAt' in a && typeof a.createdAt === 'string' ? a.createdAt : '';
    const bb = 'createdAt' in b && typeof b.createdAt === 'string' ? b.createdAt : '';
    return aa.localeCompare(bb);
  });

  const latest = merged.at(-1) as { decision?: string } | undefined;
  const payload = {
    changeId,
    updatedAt: new Date().toISOString(),
    latestDecision: latest?.decision ?? null,
    events: merged,
  };

  const filePath = `openspec/approvals/${changeId}.json`;
  const content = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`).toString('base64');

  await githubRequest(`/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `chore(approvals): sync ${changeId}`,
      content,
      branch: config.githubBranch,
      sha: remote.sha,
    }),
  });

  markApprovalsSynced(changeId);
}

export async function processSyncJobs(): Promise<void> {
  if (globalWorker.processingSync) return;
  globalWorker.processingSync = true;

  try {
    const jobs = listPendingSyncJobs(5);
    for (const job of jobs) {
      try {
        await syncChangeToGithub(job.changeId);
        updateSyncJob(job.id, 'done');
        events.emit('stream', {
          type: 'sync_status',
          message: `Synced approvals for ${job.changeId}`,
          payload: { changeId: job.changeId, status: 'synced' },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const finalStatus = job.attempts >= 4 ? 'failed' : 'retrying';
        updateSyncJob(job.id, finalStatus, message);
        markApprovalsFailed(job.changeId);
        events.emit('stream', {
          type: 'sync_status',
          message: `Sync failed for ${job.changeId}`,
          payload: { changeId: job.changeId, status: finalStatus, error: message },
        });
      }
    }
  } finally {
    globalWorker.processingSync = false;
  }
}
