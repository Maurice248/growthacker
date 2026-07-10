export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import {
  fetchAdminOperations,
  summarizeOperations,
  type NormalizedOperationStatus,
} from '@/lib/admin/operations';

export async function GET(req: NextRequest) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const companyId = searchParams.get('companyId') || undefined;
  const module = searchParams.get('module') || undefined;
  const status = (searchParams.get('status') as NormalizedOperationStatus | null) || undefined;
  const limit = Math.min(Number(searchParams.get('limit') || 100), 200);

  const allEvents = await fetchAdminOperations({ companyId, limit: Math.max(limit, 200) });
  const summary = summarizeOperations(allEvents);

  let events = allEvents;
  if (module) {
    const mod = module.toLowerCase();
    events = events.filter((e) => e.module.toLowerCase().includes(mod));
  }
  if (status) {
    events = events.filter((e) => e.normalizedStatus === status);
  }
  events = events.slice(0, limit);

  return NextResponse.json({ summary, events });
}
