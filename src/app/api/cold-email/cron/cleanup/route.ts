export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { runCleanupForAllCompanies } from '@/lib/cold-email/cleanup';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runCleanupForAllCompanies();
    return NextResponse.json({ ok: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron cleanup failed';
    console.error('[cold-email/cron/cleanup]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
