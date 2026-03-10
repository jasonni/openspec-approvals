import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { getChangeDetail } from '@/lib/openspec';
import { listApprovals } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  ensureBootstrapped();
  const { id } = await params;
  const detail = getChangeDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'Change not found' }, { status: 404 });
  }

  return NextResponse.json({
    change: detail,
    approvals: listApprovals(id),
  });
}
