import { NextResponse } from 'next/server';
import {
  getOrCreateReviewSession,
  listReviewSessions,
  updateReviewSessionDraft,
} from '@/lib/db';
import { getProject } from '@/lib/projects';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId')?.trim();
  const changeId = searchParams.get('changeId')?.trim();
  if (!projectId || !changeId) {
    return NextResponse.json({ error: 'projectId and changeId are required' }, { status: 400 });
  }
  if (!getProject(projectId)) {
    return NextResponse.json({ error: `Unknown projectId: ${projectId}` }, { status: 404 });
  }
  const sessions = listReviewSessions(projectId, changeId);
  return NextResponse.json({ sessions });
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as {
    projectId?: string;
    changeId?: string;
    reviewer?: string;
    sessionBody?: string;
    decision?: string | null;
  };

  if (!body.projectId || !body.changeId) {
    return NextResponse.json({ error: 'projectId and changeId are required' }, { status: 400 });
  }
  if (!getProject(body.projectId)) {
    return NextResponse.json({ error: `Unknown projectId: ${body.projectId}` }, { status: 404 });
  }

  const reviewer = body.reviewer ?? 'reviewer';
  const session = getOrCreateReviewSession(body.projectId, body.changeId, reviewer);

  if (body.sessionBody !== undefined || body.decision !== undefined) {
    updateReviewSessionDraft(session.id, body.sessionBody ?? session.body, body.decision ?? null);
  }

  return NextResponse.json({ session: getOrCreateReviewSession(body.projectId, body.changeId, reviewer) });
}
