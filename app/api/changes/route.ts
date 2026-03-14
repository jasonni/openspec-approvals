import { NextResponse } from 'next/server';
import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { latestDecisionByChange } from '@/lib/db';
import { listChanges } from '@/lib/openspec';
import { getProject } from '@/lib/projects';

export const runtime = 'nodejs';

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
  const changes = listChanges(projectId);
  const latest = latestDecisionByChange(projectId);

  return NextResponse.json({
    projectId,
    changes: changes.map((c) => ({
      ...c,
      decision: latest[c.id],
    })),
  });
}
