export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { createLeadList, listLeadLists } from '@/lib/cold-email/config';

export async function GET() {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const lists = await listLeadLists(companyId);
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const body = await req.json();
  const name = String(body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'List name is required' }, { status: 400 });
  }

  try {
    const list = await createLeadList(companyId, name, body.description || '');
    return NextResponse.json({ list });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create list';
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A list with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
