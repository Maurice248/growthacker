export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { runBlogAdvanceWorker } from '@/lib/blog/advance-worker';

/**
 * Optional manual/external trigger (CRON_SECRET).
 * Not registered in vercel.json — Hobby only allows once-per-day crons.
 * Daily scheduled advancement runs inside /api/blog/cron/generate.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runBlogAdvanceWorker();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[API blog/cron/advance]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron advance failed' },
      { status: 500 }
    );
  }
}
