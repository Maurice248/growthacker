export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { countLeadsByStatus, listLeads } from '@/lib/cold-email/config';

export async function GET(req: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const { searchParams } = new URL(req.url);
  const listId = searchParams.get('listId') || undefined;
  const sentStatus = searchParams.get('sentStatus') || undefined;
  const limit = Number(searchParams.get('limit') || 100);

  const [leads, counts] = await Promise.all([
    listLeads(companyId, { listId, sentStatus, limit }),
    countLeadsByStatus(companyId, listId),
  ]);

  return NextResponse.json({ leads, counts });
}
