import { type DatePreset } from '@/lib/ads-library/date-presets';
import { resolveAdLibraryMaxAds } from '@/lib/ads-library/max-ads';

export type AdsLibraryFilterState = {
  /** Committed search terms (shown as tags in the search bar). */
  searchTerms: string[];
  /** Draft text in the search input (not applied until comma / Enter). */
  q: string;
  includeCountries: string[];
  excludeCountries: string[];
  statusActive: boolean;
  statusInactive: boolean;
  includeLanguages: string[];
  excludeLanguages: string[];
  copyMin: string;
  copyMax: string;
  videoMin: string;
  videoMax: string;
  mediaTypes: string[];
  daysRunningMin: string;
  daysRunningMax: string;
  createdFrom: string;
  createdTo: string;
  createdPreset: DatePreset;
  lastSeenFrom: string;
  lastSeenTo: string;
  lastSeenPreset: DatePreset;
  angle: string;
  /** How many ads to fetch from Meta Ads Library (default 10). */
  maxAds: string;
};

export const EMPTY_ADS_LIBRARY_FILTERS: AdsLibraryFilterState = {
  searchTerms: [],
  q: '',
  includeCountries: [],
  excludeCountries: [],
  statusActive: false,
  statusInactive: false,
  includeLanguages: [],
  excludeLanguages: [],
  copyMin: '',
  copyMax: '',
  videoMin: '',
  videoMax: '',
  mediaTypes: [],
  daysRunningMin: '',
  daysRunningMax: '',
  createdFrom: '',
  createdTo: '',
  createdPreset: '',
  lastSeenFrom: '',
  lastSeenTo: '',
  lastSeenPreset: '',
  angle: '',
  maxAds: '10',
};

export function adsLibrarySearchQuery(filters: AdsLibraryFilterState): string {
  return filters.searchTerms.join(',');
}

export function buildAdsLibrarySearchParams(
  filters: AdsLibraryFilterState,
  page: number
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.includeCountries.length) {
    params.set('countriesInclude', filters.includeCountries.join(','));
  }
  if (filters.excludeCountries.length) {
    params.set('countriesExclude', filters.excludeCountries.join(','));
  }
  if (filters.statusActive) params.set('statusActive', '1');
  if (filters.statusInactive) params.set('statusInactive', '1');
  if (filters.includeLanguages.length) {
    params.set('languagesInclude', filters.includeLanguages.join(','));
  }
  if (filters.excludeLanguages.length) {
    params.set('languagesExclude', filters.excludeLanguages.join(','));
  }
  if (filters.copyMin) params.set('copyMin', filters.copyMin);
  if (filters.copyMax) params.set('copyMax', filters.copyMax);
  if (filters.videoMin) params.set('videoMin', filters.videoMin);
  if (filters.videoMax) params.set('videoMax', filters.videoMax);
  if (filters.mediaTypes.length) params.set('mediaTypes', filters.mediaTypes.join(','));
  if (filters.daysRunningMin) params.set('daysRunningMin', filters.daysRunningMin);
  if (filters.daysRunningMax) params.set('daysRunningMax', filters.daysRunningMax);
  if (filters.createdPreset) params.set('createdPreset', filters.createdPreset);
  else {
    if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
    if (filters.createdTo) params.set('createdTo', filters.createdTo);
  }
  if (filters.lastSeenPreset) params.set('lastSeenPreset', filters.lastSeenPreset);
  else {
    if (filters.lastSeenFrom) params.set('lastSeenFrom', filters.lastSeenFrom);
    if (filters.lastSeenTo) params.set('lastSeenTo', filters.lastSeenTo);
  }
  if (filters.angle) params.set('angle', filters.angle);
  params.set('maxAds', resolveAdLibraryMaxAds(filters.maxAds).toString());
  const query = adsLibrarySearchQuery(filters);
  if (query) params.set('q', query);
  params.set('page', String(page));
  params.set('pageSize', String(resolveAdLibraryMaxAds(filters.maxAds)));
  return params;
}

export function adsLibraryFiltersActive(filters: AdsLibraryFilterState): boolean {
  return (
    filters.includeCountries.length > 0 ||
    filters.excludeCountries.length > 0 ||
    filters.statusActive ||
    filters.statusInactive ||
    filters.includeLanguages.length > 0 ||
    filters.excludeLanguages.length > 0 ||
    !!filters.copyMin ||
    !!filters.copyMax ||
    !!filters.videoMin ||
    !!filters.videoMax ||
    filters.mediaTypes.length > 0 ||
    !!filters.daysRunningMin ||
    !!filters.daysRunningMax ||
    !!filters.createdFrom ||
    !!filters.createdTo ||
    !!filters.createdPreset ||
    !!filters.lastSeenFrom ||
    !!filters.lastSeenTo ||
    !!filters.lastSeenPreset ||
    !!filters.angle ||
    filters.searchTerms.length > 0
  );
}
