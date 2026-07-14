export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { runDueAutomations } from '@/lib/meta-automation/evaluate';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runDueAutomations();
    return NextResponse.json({ ok: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Automation evaluation failed';
    console.error('[meta/automation/cron/evaluate]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
