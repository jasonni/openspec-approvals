import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { searchDocuments } from '@/lib/search';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  ensureBootstrapped();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const limit = Number(searchParams.get('limit') ?? '20');

  return NextResponse.json({
    query: q,
    hits: searchDocuments(q, Number.isFinite(limit) ? Math.min(limit, 100) : 20),
  });
}
