export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const MIGRATED_MESSAGE =
  'Social workflow editor has moved to native Creator Studio. Configure brand and posting in Social Overview; prompts are server-managed.';

export async function GET() {
  return NextResponse.json({ error: MIGRATED_MESSAGE, migrated: true }, { status: 410 });
}

export async function PUT() {
  return NextResponse.json({ error: MIGRATED_MESSAGE, migrated: true }, { status: 410 });
}
