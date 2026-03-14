import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { createApproval, createSyncJob, listApprovals } from '@/lib/db';
import { emitStreamEvent } from '@/lib/events';
import { processSyncJobs } from '@/lib/github-sync';
import { getProject } from '@/lib/projects';
import type { ApprovalDecision, ArtifactType } from '@/lib/types';

export const runtime = 'nodejs';

function isDecision(value: string): value is ApprovalDecision {
  return ['approve', 'request_changes', 'reject'].includes(value);
}

function isArtifactType(value: string): value is ArtifactType {
  return ['proposal', 'design', 'tasks', 'spec'].includes(value);
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId')?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  if (!getProject(projectId)) {
    return NextResponse.json({ error: `Unknown projectId: ${projectId}` }, { status: 404 });
  }
  ensureProjectBootstrapped(projectId);

  const changeId = searchParams.get('changeId') ?? undefined;
  return NextResponse.json({ projectId, approvals: listApprovals(projectId, changeId) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as {
    projectId?: string;
    changeId?: string;
    artifactType?: string;
    decision?: string;
    comment?: string;
    reviewer?: string;
  };

  if (!body.projectId || !body.changeId || !body.decision || !body.artifactType) {
    return NextResponse.json(
      { error: 'projectId, changeId, artifactType and decision are required' },
      { status: 400 }
    );
  }

  if (!getProject(body.projectId)) {
    return NextResponse.json({ error: `Unknown projectId: ${body.projectId}` }, { status: 404 });
  }
  ensureProjectBootstrapped(body.projectId);

  if (!isDecision(body.decision) || !isArtifactType(body.artifactType)) {
    return NextResponse.json({ error: 'Invalid decision or artifactType' }, { status: 400 });
  }

  const id = randomUUID();
  createApproval({
    id,
    projectId: body.projectId,
    changeId: body.changeId,
    artifactType: body.artifactType,
    decision: body.decision,
    comment: body.comment ?? '',
    reviewer: body.reviewer ?? 'local-reviewer',
  });

  createSyncJob(body.projectId, body.changeId);
  emitStreamEvent({
    projectId: body.projectId,
    type: 'approval_created',
    message: `Approval created for ${body.changeId}`,
    payload: { projectId: body.projectId, changeId: body.changeId, id },
  });

  processSyncJobs().catch(() => {
    // background fallback via timer
  });

  return NextResponse.json({ id }, { status: 201 });
}
