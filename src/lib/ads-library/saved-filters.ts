import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { AdsLibraryFilterState } from '@/lib/ads-library/filter-state';
import {
  adsLibraryFiltersHashPayload,
  normalizeAdsLibraryFiltersForSave,
  type AdsLibrarySavedFilterRecord,
} from '@/lib/ads-library/saved-filters-shared';

export type { AdsLibrarySavedFilterRecord };
export { normalizeAdsLibraryFiltersForSave };

export function computeAdsLibraryFiltersHash(filters: AdsLibraryFilterState): string {
  return createHash('sha256').update(adsLibraryFiltersHashPayload(filters)).digest('hex');
}

function rowToApi(row: {
  id: string;
  label: string;
  filters: unknown;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}): AdsLibrarySavedFilterRecord {
  return {
    id: row.id,
    label: row.label,
    filters: normalizeAdsLibraryFiltersForSave(row.filters as Partial<AdsLibraryFilterState>),
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdsLibrarySavedFilters(companyId: string) {
  const rows = await prisma.adLibrarySavedFilter.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(rowToApi);
}

export async function createAdsLibrarySavedFilter(
  companyId: string,
  label: string,
  filtersInput: Partial<AdsLibraryFilterState>
) {
  const filters = normalizeAdsLibraryFiltersForSave(filtersInput);
  const contentHash = computeAdsLibraryFiltersHash(filters);

  const duplicate = await prisma.adLibrarySavedFilter.findFirst({
    where: { companyId, contentHash },
    select: { id: true },
  });
  if (duplicate) {
    return { duplicate: true as const };
  }

  const row = await prisma.adLibrarySavedFilter.create({
    data: {
      companyId,
      label,
      filters,
      contentHash,
    },
  });

  return { savedFilter: rowToApi(row) };
}

export async function renameAdsLibrarySavedFilter(
  companyId: string,
  id: string,
  label: string
) {
  const result = await prisma.adLibrarySavedFilter.updateMany({
    where: { id, companyId },
    data: { label },
  });
  if (result.count === 0) return null;
  const row = await prisma.adLibrarySavedFilter.findUnique({ where: { id } });
  return row ? rowToApi(row) : null;
}

export async function deleteAdsLibrarySavedFilter(companyId: string, id: string) {
  const result = await prisma.adLibrarySavedFilter.deleteMany({
    where: { id, companyId },
  });
  return result.count > 0;
}
