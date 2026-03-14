import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  submitReviewSession,
  updateReviewSessionDraft,
  listReviewSessions,
  createApproval,
  createSyncJob,
  listInlineComments,
} from '@/lib/db';
import { emitStreamEvent } from '@/lib/events';
import { processSyncJobs } from '@/lib/github-sync';
import { getProject } from '@/lib/projects';
import type { ApprovalDecision } from '@/lib/types';

export const runtime = 'nodejs';

function isDecision(v: string): v is ApprovalDecision {
  return ['approve', 'request_changes', 'reject'].includes(v);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json()) as {
    action?: string;
    sessionBody?: string;
    decision?: string;
    projectId?: string;
    changeId?: string;
    reviewer?: string;
  };

  if (body.action === 'save') {
    updateReviewSessionDraft(id, body.sessionBody ?? '', body.decision ?? null);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'submit') {
    if (!body.projectId || !body.changeId) {
      return NextResponse.json({ error: 'projectId and changeId required for submit' }, { status: 400 });
    }
    const project = getProject(body.projectId);
    if (!project) return NextResponse.json({ error: 'Unknown project' }, { status: 404 });

    // Submit the session
    submitReviewSession(id);

    // If decision provided, create legacy approval for backward compat + GitHub sync
    if (body.decision && isDecision(body.decision)) {
      const approvalId = randomUUID();
      // Determine the primary artifact type based on comments
      const comments = listInlineComments(body.projectId, body.changeId);
      const artifactType = comments[0]?.artifactType ?? 'proposal';
      createApproval({
        id: approvalId,
        projectId: body.projectId,
        changeId: body.changeId,
        artifactType,
        decision: body.decision,
        comment: body.sessionBody ?? '',
        reviewer: body.reviewer ?? 'reviewer',
      });
      createSyncJob(body.projectId, body.changeId);
      emitStreamEvent({
        projectId: body.projectId,
        type: 'approval_created',
        message: `Review submitted for ${body.changeId} — ${body.decision}`,
        payload: { projectId: body.projectId, changeId: body.changeId, id: approvalId },
      });
      processSyncJobs().catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'action must be save or submit' }, { status: 400 });
}
