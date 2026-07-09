export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const MIGRATED_MESSAGE =
  'Blog workflow restore has moved to native automation. Edit prompts in Blog → Automation.';

export async function POST() {
  return NextResponse.json({ error: MIGRATED_MESSAGE, migrated: true }, { status: 410 });
}
