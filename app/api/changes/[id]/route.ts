import { NextResponse } from 'next/server';
import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { getChangeDetail } from '@/lib/openspec';
import { listApprovals } from '@/lib/db';
import { getProject } from '@/lib/projects';
import { resolveSpecDocumentView } from '@/lib/spec-docs';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId')?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }
  if (!getProject(projectId)) {
    return NextResponse.json({ error: `Unknown projectId: ${projectId}` }, { status: 404 });
  }

  ensureProjectBootstrapped(projectId);
  const { id } = await params;
  const requestedDocView = searchParams.get('doc') ?? undefined;
  const detail = getChangeDetail(projectId, id);
  if (!detail) {
    return NextResponse.json({ error: 'Change not found' }, { status: 404 });
  }
  const docView = resolveSpecDocumentView(detail.artifacts, requestedDocView);

  return NextResponse.json({
    projectId,
    change: detail,
    approvals: listApprovals(projectId, id),
    specView: {
      activeView: docView.activeView,
      availableViews: docView.availableViews,
      activeArtifactType: docView.activeArtifact?.type ?? null,
    },
  });
}
