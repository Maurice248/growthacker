import { createHash } from 'crypto';
import { isDatePresetId, resolveDatePresetRange, type DatePresetId } from './date-presets';
import type { FacebookSearchParams } from './facebook-url';
import { resolveAdLibraryMaxAds } from './max-ads';

export type FacebookSideParams = {
  queryTerms: string[];
  countriesInclude: string[];
  statusActive: boolean;
  statusInactive: boolean;
  languagesInclude: string[];
  mediaTypes: string[];
  createdFrom: string;
  createdTo: string;
  createdPreset: string;
  viewAllPageId: string;
  maxAds: number;
};

export type LocalRefinementParams = {
  countriesExclude: string[];
  languagesExclude: string[];
  copyMin: string;
  copyMax: string;
  videoMin: string;
  videoMax: string;
  daysRunningMin: string;
  daysRunningMax: string;
  lastSeenFrom: string;
  lastSeenTo: string;
  lastSeenPreset: string;
  angle: string;
  adType: string;
  country: string;
  status: string;
  language: string;
  copyLength: string;
  videoLength: string;
  daysRunning: string;
  qExtra: string;
};

export type ParsedAdsLibraryRequest = {
  facebook: FacebookSideParams;
  local: LocalRefinementParams;
  page: number;
  pageSize: number;
};

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseAdsLibrarySearchParams(searchParams: URLSearchParams): ParsedAdsLibraryRequest {
  const q = searchParams.get('q')?.trim() || '';
  const queryTerms = splitList(q);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    500,
    Math.max(1, parseInt(searchParams.get('pageSize') || String(resolveAdLibraryMaxAds(searchParams.get('maxAds'))), 10) || resolveAdLibraryMaxAds(searchParams.get('maxAds')))
  );

  return {
    facebook: {
      queryTerms,
      countriesInclude: splitList(searchParams.get('countriesInclude')?.trim() || ''),
      statusActive: searchParams.get('statusActive') === '1',
      statusInactive: searchParams.get('statusInactive') === '1',
      languagesInclude: splitList(searchParams.get('languagesInclude')?.trim() || ''),
      mediaTypes: splitList(searchParams.get('mediaTypes')?.trim() || '').map((t) =>
        t.toLowerCase()
      ),
      createdFrom: searchParams.get('createdFrom')?.trim() || '',
      createdTo: searchParams.get('createdTo')?.trim() || '',
      createdPreset: searchParams.get('createdPreset')?.trim() || '',
      viewAllPageId: searchParams.get('viewAllPageId')?.trim() || '',
      maxAds: resolveAdLibraryMaxAds(searchParams.get('maxAds')),
    },
    local: {
      countriesExclude: splitList(searchParams.get('countriesExclude')?.trim() || ''),
      languagesExclude: splitList(searchParams.get('languagesExclude')?.trim() || ''),
      copyMin: searchParams.get('copyMin')?.trim() || '',
      copyMax: searchParams.get('copyMax')?.trim() || '',
      videoMin: searchParams.get('videoMin')?.trim() || '',
      videoMax: searchParams.get('videoMax')?.trim() || '',
      daysRunningMin: searchParams.get('daysRunningMin')?.trim() || '',
      daysRunningMax: searchParams.get('daysRunningMax')?.trim() || '',
      lastSeenFrom: searchParams.get('lastSeenFrom')?.trim() || '',
      lastSeenTo: searchParams.get('lastSeenTo')?.trim() || '',
      lastSeenPreset: searchParams.get('lastSeenPreset')?.trim() || '',
      angle: searchParams.get('angle')?.trim() || '',
      adType: searchParams.get('adType')?.trim() || searchParams.get('mediaType')?.trim() || '',
      country: searchParams.get('country')?.trim() || '',
      status: searchParams.get('status')?.trim() || '',
      language: searchParams.get('language')?.trim() || '',
      copyLength: searchParams.get('copyLength')?.trim() || '',
      videoLength: searchParams.get('videoLength')?.trim() || '',
      daysRunning: searchParams.get('daysRunning')?.trim() || '',
      qExtra: q,
    },
    page,
    pageSize,
  };
}

function resolveCreatedDates(fb: FacebookSideParams): { min: string; max: string } {
  if (fb.createdPreset && isDatePresetId(fb.createdPreset)) {
    const { from, to } = resolveDatePresetRange(fb.createdPreset as DatePresetId);
    return { min: from, max: to };
  }
  return { min: fb.createdFrom, max: fb.createdTo };
}

function activeStatusFromCheckboxes(active: boolean, inactive: boolean): 'all' | 'active' | 'inactive' {
  if (active && !inactive) return 'active';
  if (inactive && !active) return 'inactive';
  return 'all';
}

function mediaTypeFromList(types: string[]): FacebookSearchParams['mediaType'] {
  if (!types.length || types.length > 1) return 'all';
  const t = types[0];
  if (t === 'image' || t === 'video' || t === 'meme' || t === 'none' || t === 'text') {
    if (t === 'text') return 'none';
    return t;
  }
  return 'all';
}

export function facebookSideToSearchParams(fb: FacebookSideParams): FacebookSearchParams & {
  countries: string[];
} {
  const created = resolveCreatedDates(fb);
  const countries = fb.countriesInclude.length
    ? fb.countriesInclude.map((c) => c.toUpperCase())
    : ['ALL'];

  return {
    query: fb.queryTerms.join(', '),
    searchType: fb.viewAllPageId ? 'page' : 'keyword_unordered',
    viewAllPageId: fb.viewAllPageId,
    country: countries[0] ?? 'ALL',
    countries,
    activeStatus: activeStatusFromCheckboxes(fb.statusActive, fb.statusInactive),
    mediaType: mediaTypeFromList(fb.mediaTypes),
    languages: fb.languagesInclude,
    startDateMin: created.min,
    startDateMax: created.max,
  };
}

/** Stable hash for Facebook-side filter combinations (excludes pagination and local refinements). */
/** Bump when Facebook-side scrape semantics change (invalidates cached searches). */
const SEARCH_KEY_VERSION = 4;

/** Meta often requires a q= term; use a broad placeholder when the user only set filters. */
export function effectiveApifyKeywords(fb: FacebookSideParams): string[] {
  if (fb.queryTerms.length > 0) return fb.queryTerms;
  if (fb.viewAllPageId.trim()) return [];
  return ['the'];
}

export function apifyResultsLimitForMaxAds(maxAds: number): number {
  return Math.min(500, Math.max(maxAds, maxAds * 3));
}

export function computeSearchKey(fb: FacebookSideParams): string {
  const payload = JSON.stringify({
    v: SEARCH_KEY_VERSION,
    queryTerms: [...fb.queryTerms].sort(),
    countriesInclude: [...fb.countriesInclude].map((c) => c.toUpperCase()).sort(),
    statusActive: fb.statusActive,
    statusInactive: fb.statusInactive,
    languagesInclude: [...fb.languagesInclude].map((l) => l.toLowerCase()).sort(),
    mediaTypes: [...fb.mediaTypes].sort(),
    createdFrom: fb.createdFrom,
    createdTo: fb.createdTo,
    createdPreset: fb.createdPreset,
    viewAllPageId: fb.viewAllPageId,
    maxAds: fb.maxAds,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

export function facebookSideHasSearchCriteria(fb: FacebookSideParams): boolean {
  if (fb.viewAllPageId.trim()) return true;
  if (fb.queryTerms.length > 0) return true;
  if (fb.countriesInclude.length > 0) return true;
  if (fb.statusActive || fb.statusInactive) return true;
  if (fb.languagesInclude.length > 0) return true;
  if (fb.mediaTypes.length > 0) return true;
  if (fb.createdFrom || fb.createdTo || fb.createdPreset) return true;
  return false;
}
