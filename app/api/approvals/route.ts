import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { createApproval, createSyncJob, listApprovals } from '@/lib/db';
import { events } from '@/lib/events';
import { processSyncJobs } from '@/lib/github-sync';
import type { ApprovalDecision, ArtifactType } from '@/lib/types';

export const runtime = 'nodejs';

function isDecision(value: string): value is ApprovalDecision {
  return ['approve', 'request_changes', 'reject'].includes(value);
}

function isArtifactType(value: string): value is ArtifactType {
  return ['proposal', 'design', 'tasks', 'spec'].includes(value);
}

export async function GET(request: Request): Promise<NextResponse> {
  ensureBootstrapped();
  const { searchParams } = new URL(request.url);
  const changeId = searchParams.get('changeId') ?? undefined;
  return NextResponse.json({ approvals: listApprovals(changeId) });
}

export async function POST(request: Request): Promise<NextResponse> {
  ensureBootstrapped();
  const body = (await request.json()) as {
    changeId?: string;
    artifactType?: string;
    decision?: string;
    comment?: string;
    reviewer?: string;
  };

  if (!body.changeId || !body.decision || !body.artifactType) {
    return NextResponse.json({ error: 'changeId, artifactType and decision are required' }, { status: 400 });
  }

  if (!isDecision(body.decision) || !isArtifactType(body.artifactType)) {
    return NextResponse.json({ error: 'Invalid decision or artifactType' }, { status: 400 });
  }

  const id = randomUUID();
  createApproval({
    id,
    changeId: body.changeId,
    artifactType: body.artifactType,
    decision: body.decision,
    comment: body.comment ?? '',
    reviewer: body.reviewer ?? 'local-reviewer',
  });

  createSyncJob(body.changeId);
  events.emit('stream', {
    type: 'approval_created',
    message: `Approval created for ${body.changeId}`,
    payload: { changeId: body.changeId, id },
  });

  processSyncJobs().catch(() => {
    // background fallback via timer
  });

  return NextResponse.json({ id }, { status: 201 });
}
