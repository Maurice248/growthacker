export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { adsLibraryFiltersActive } from '@/lib/ads-library/filter-state';
import { normalizeAdsLibraryFiltersForSave } from '@/lib/ads-library/saved-filters-shared';
import {
  createAdsLibrarySavedFilter,
  listAdsLibrarySavedFilters,
} from '@/lib/ads-library/saved-filters';

export async function GET() {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  try {
    const savedFilters = await listAdsLibrarySavedFilters(companyId);
    return NextResponse.json({ savedFilters });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list saved filters';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  try {
    const body = await req.json();
    const label = String(body.label ?? '').trim();
    if (!label) {
      return NextResponse.json({ error: 'Filter name is required' }, { status: 400 });
    }

    const filters = normalizeAdsLibraryFiltersForSave(body.filters);
    if (!adsLibraryFiltersActive(filters)) {
      return NextResponse.json(
        { error: 'Add a search term or at least one filter before saving' },
        { status: 400 }
      );
    }

    const result = await createAdsLibrarySavedFilter(companyId, label, filters);
    if ('duplicate' in result) {
      return NextResponse.json({ duplicate: true }, { status: 409 });
    }

    return NextResponse.json({ savedFilter: result.savedFilter });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save filters';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
