import { NextResponse } from 'next/server';
import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { getProject } from '@/lib/projects';
import { searchDocuments } from '@/lib/search';

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

  const q = searchParams.get('q') ?? '';
  const limit = Number(searchParams.get('limit') ?? '20');

  return NextResponse.json({
    projectId,
    query: q,
    hits: searchDocuments(projectId, q, Number.isFinite(limit) ? Math.min(limit, 100) : 20),
  });
}
