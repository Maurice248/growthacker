export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { fetchOnboardingQueue } from '@/lib/admin/metrics';

export async function GET() {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await fetchOnboardingQueue();
  return NextResponse.json(rows);
}
