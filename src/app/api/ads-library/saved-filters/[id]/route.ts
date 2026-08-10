export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  deleteAdsLibrarySavedFilter,
  renameAdsLibrarySavedFilter,
} from '@/lib/ads-library/saved-filters';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const { id } = await params;
  try {
    const body = await req.json();
    const label = String(body.label ?? '').trim();
    if (!label) {
      return NextResponse.json({ error: 'Filter name is required' }, { status: 400 });
    }

    const savedFilter = await renameAdsLibrarySavedFilter(companyId, id, label);
    if (!savedFilter) {
      return NextResponse.json({ error: 'Saved filter not found' }, { status: 404 });
    }
    return NextResponse.json({ savedFilter });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to rename saved filter';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const { id } = await params;
  try {
    const deleted = await deleteAdsLibrarySavedFilter(companyId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'Saved filter not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete saved filter';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
