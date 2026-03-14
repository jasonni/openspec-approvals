import { approvalFilePath, getProject, projectGithubEnabled } from '@/lib/projects';
import {
  listApprovals,
  listPendingSyncJobs,
  markApprovalsFailed,
  markApprovalsSynced,
  updateSyncJob,
} from '@/lib/db';
import { emitStreamEvent } from '@/lib/events';

const globalWorker = globalThis as unknown as { processingSync?: boolean };

type GithubContentResponse = {
  sha?: string;
  content?: string;
  message?: string;
};

async function githubRequest<T>(projectId: string, apiPath: string, init?: RequestInit): Promise<T> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Unknown project for sync: ${projectId}`);
  }
  if (!projectGithubEnabled(project)) {
    throw new Error(`GitHub sync is not configured for project: ${projectId}`);
  }

  const res = await fetch(`https://api.github.com${apiPath}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${project.githubToken}`,
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

async function readRemoteApprovalFile(projectId: string, changeId: string): Promise<{ sha?: string; events: unknown[] }> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Unknown project for sync: ${projectId}`);
  }
  const filePath = approvalFilePath(project.id, changeId);
  try {
    const data = await githubRequest<GithubContentResponse>(
      project.id,
      `/repos/${project.githubOwner}/${project.githubRepo}/contents/${encodeURIComponent(filePath)}?ref=${project.githubBranch}`
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

async function syncChangeToGithub(projectId: string, changeId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Unknown project for sync: ${projectId}`);
  }

  if (!projectGithubEnabled(project)) {
    markApprovalsSynced(projectId, changeId);
    return;
  }

  const localEvents = listApprovals(projectId, changeId).map((event) => ({
    id: event.id,
    projectId: event.projectId,
    changeId: event.changeId,
    artifactType: event.artifactType,
    decision: event.decision,
    comment: event.comment,
    reviewer: event.reviewer,
    createdAt: event.createdAt,
  }));

  const remote = await readRemoteApprovalFile(projectId, changeId);
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
    projectId,
    changeId,
    updatedAt: new Date().toISOString(),
    latestDecision: latest?.decision ?? null,
    events: merged,
  };

  const filePath = approvalFilePath(projectId, changeId);
  const content = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`).toString('base64');

  await githubRequest(projectId, `/repos/${project.githubOwner}/${project.githubRepo}/contents/${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `chore(approvals): sync ${projectId}/${changeId}`,
      content,
      branch: project.githubBranch,
      sha: remote.sha,
    }),
  });

  markApprovalsSynced(projectId, changeId);
}

export async function processSyncJobs(): Promise<void> {
  if (globalWorker.processingSync) return;
  globalWorker.processingSync = true;

  try {
    const jobs = listPendingSyncJobs(5);
    for (const job of jobs) {
      try {
        await syncChangeToGithub(job.projectId, job.changeId);
        updateSyncJob(job.id, 'done');
        emitStreamEvent({
          projectId: job.projectId,
          type: 'sync_status',
          message: `Synced approvals for ${job.changeId}`,
          status: 'synced',
          payload: { projectId: job.projectId, changeId: job.changeId, status: 'synced' },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const finalStatus = job.attempts >= 4 ? 'failed' : 'retrying';
        updateSyncJob(job.id, finalStatus, message);
        markApprovalsFailed(job.projectId, job.changeId);
        emitStreamEvent({
          projectId: job.projectId,
          type: 'sync_status',
          message: `Sync failed for ${job.changeId}`,
          status: finalStatus,
          payload: { projectId: job.projectId, changeId: job.changeId, status: finalStatus, error: message },
        });
      }
    }
  } finally {
    globalWorker.processingSync = false;
  }
}
