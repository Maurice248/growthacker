export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { fetchUsageMetrics, type UsageWindow } from '@/lib/admin/metrics';

export async function GET(req: NextRequest) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const windowParam = req.nextUrl.searchParams.get('window');
  const window: UsageWindow = windowParam === '30d' ? '30d' : '7d';
  const data = await fetchUsageMetrics(window);

  return NextResponse.json(data);
}
