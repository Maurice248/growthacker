export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const MIGRATED_MESSAGE =
  'Blog workflow editor has moved to native automation. Configure schedule, prompts, and categories in Blog → Automation.';

export async function GET() {
  return NextResponse.json({ error: MIGRATED_MESSAGE, migrated: true }, { status: 410 });
}

export async function PUT() {
  return NextResponse.json({ error: MIGRATED_MESSAGE, migrated: true }, { status: 410 });
}
