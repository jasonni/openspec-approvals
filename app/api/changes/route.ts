import { NextResponse } from 'next/server';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { latestDecisionByChange } from '@/lib/db';
import { listChanges } from '@/lib/openspec';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  ensureBootstrapped();
  const changes = listChanges();
  const latest = latestDecisionByChange();

  return NextResponse.json({
    changes: changes.map((c) => ({
      ...c,
      decision: latest[c.id],
    })),
  });
}
