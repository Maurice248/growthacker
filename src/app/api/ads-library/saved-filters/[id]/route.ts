export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  deleteAdsLibrarySavedFilter,
  renameAdsLibrarySavedFilter,
  updateAdsLibrarySavedFilter,
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
    const hasFilters = body.filters !== undefined;
    const label = body.label !== undefined ? String(body.label ?? '').trim() : undefined;

    if (!hasFilters && label === undefined) {
      return NextResponse.json(
        { error: 'Provide a filter name and/or filters to update' },
        { status: 400 }
      );
    }

    if (hasFilters) {
      const result = await updateAdsLibrarySavedFilter(companyId, id, body.filters);
      if (!result) {
        return NextResponse.json({ error: 'Saved filter not found' }, { status: 404 });
      }
      if ('duplicate' in result && result.duplicate) {
        return NextResponse.json(
          { error: 'These filters are already saved', duplicate: true },
          { status: 409 }
        );
      }
      if (label !== undefined) {
        if (!label) {
          return NextResponse.json({ error: 'Filter name is required' }, { status: 400 });
        }
        const renamed = await renameAdsLibrarySavedFilter(companyId, id, label);
        if (!renamed) {
          return NextResponse.json({ error: 'Saved filter not found' }, { status: 404 });
        }
        return NextResponse.json({ savedFilter: renamed });
      }
      return NextResponse.json({ savedFilter: result.savedFilter });
    }

    if (!label) {
      return NextResponse.json({ error: 'Filter name is required' }, { status: 400 });
    }

    const savedFilter = await renameAdsLibrarySavedFilter(companyId, id, label);
    if (!savedFilter) {
      return NextResponse.json({ error: 'Saved filter not found' }, { status: 404 });
    }
    return NextResponse.json({ savedFilter });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update saved filter';
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
