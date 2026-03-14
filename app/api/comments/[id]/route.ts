import { NextResponse } from 'next/server';
import { resolveInlineComment, reopenInlineComment } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json()) as { action?: string; resolvedBy?: string };

  if (body.action === 'resolve') {
    resolveInlineComment(id, body.resolvedBy ?? 'reviewer');
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'reopen') {
    reopenInlineComment(id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'action must be resolve or reopen' }, { status: 400 });
}
