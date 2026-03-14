import { NextResponse } from 'next/server';
import { ensureProjectBootstrapped } from '@/lib/bootstrap';
import { loadDashboardData } from '@/lib/dashboard';
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
  return NextResponse.json(loadDashboardData(projectId));
}
