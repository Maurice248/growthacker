export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const MIGRATED_MESSAGE =
  'Execution polling retired. Use /api/blog/job?jobId=... for native blog job status.';

export async function GET() {
  return NextResponse.json({ error: MIGRATED_MESSAGE, migrated: true }, { status: 410 });
}
