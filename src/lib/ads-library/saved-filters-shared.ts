import {
  EMPTY_ADS_LIBRARY_FILTERS,
  type AdsLibraryFilterState,
} from '@/lib/ads-library/filter-state';

export type AdsLibrarySavedFilterRecord = {
  id: string;
  label: string;
  filters: AdsLibraryFilterState;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

/** Normalize filter payload for storage / hashing (draft `q` is never persisted). */
export function normalizeAdsLibraryFiltersForSave(
  input: Partial<AdsLibraryFilterState> | null | undefined
): AdsLibraryFilterState {
  const base = { ...EMPTY_ADS_LIBRARY_FILTERS, ...(input ?? {}) };
  return {
    searchTerms: asStringArray(base.searchTerms),
    q: '',
    includeCountries: asStringArray(base.includeCountries),
    excludeCountries: asStringArray(base.excludeCountries),
    statusActive: Boolean(base.statusActive),
    statusInactive: Boolean(base.statusInactive),
    includeLanguages: asStringArray(base.includeLanguages),
    excludeLanguages: asStringArray(base.excludeLanguages),
    copyMin: String(base.copyMin ?? ''),
    copyMax: String(base.copyMax ?? ''),
    videoMin: String(base.videoMin ?? ''),
    videoMax: String(base.videoMax ?? ''),
    mediaTypes: asStringArray(base.mediaTypes),
    daysRunningMin: String(base.daysRunningMin ?? ''),
    daysRunningMax: String(base.daysRunningMax ?? ''),
    createdFrom: String(base.createdFrom ?? ''),
    createdTo: String(base.createdTo ?? ''),
    createdPreset: (base.createdPreset ?? '') as AdsLibraryFilterState['createdPreset'],
    lastSeenFrom: String(base.lastSeenFrom ?? ''),
    lastSeenTo: String(base.lastSeenTo ?? ''),
    lastSeenPreset: (base.lastSeenPreset ?? '') as AdsLibraryFilterState['lastSeenPreset'],
    angle: String(base.angle ?? ''),
    maxAds: String(base.maxAds ?? '10') || '10',
  };
}

/** Stable JSON for hashing — sorted keys via normalize shape. */
export function adsLibraryFiltersHashPayload(filters: AdsLibraryFilterState): string {
  return JSON.stringify(normalizeAdsLibraryFiltersForSave(filters));
}
