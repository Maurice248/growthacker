export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { fetchIntegrationDiagnostics } from '@/lib/admin/metrics';

export async function GET(req: NextRequest) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const missingOnly = req.nextUrl.searchParams.get('missingOnly') === 'true';
  let rows = await fetchIntegrationDiagnostics();

  if (missingOnly) {
    rows = rows.filter((r) => r.missingCount > 0 || !r.integrationsConfigured);
  }

  return NextResponse.json(rows);
}
