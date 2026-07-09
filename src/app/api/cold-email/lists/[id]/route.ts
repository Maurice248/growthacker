export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  deleteLeadList,
  getLeadList,
  updateLeadList,
} from '@/lib/cold-email/config';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const { id } = await params;
  const list = await getLeadList(companyId, id);
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  return NextResponse.json({ list });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const { id } = await params;
  const body = await req.json();

  try {
    const list = await updateLeadList(companyId, id, {
      name: body.name,
      description: body.description,
    });
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }
    return NextResponse.json({ list });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update list';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const { id } = await params;
  const deleted = await deleteLeadList(companyId, id);
  if (!deleted) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
