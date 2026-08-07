export type FacebookSearchParams = {
  query: string;
  searchType?: 'keyword_unordered' | 'keyword_exact_phrase' | 'page';
  viewAllPageId?: string;
  country: string;
  activeStatus?: 'all' | 'active' | 'inactive';
  adCategory?: 'all' | 'political_and_issue_ads';
  mediaType?: 'all' | 'image' | 'video' | 'meme' | 'none';
  platforms?: string[];
  languages?: string[];
  startDateMin?: string;
  startDateMax?: string;
  sortMode?: string;
};

const FB_LIBRARY_BASE = 'https://www.facebook.com/ads/library/';

export function buildAdsLibraryUrl(params: FacebookSearchParams): string {
  const searchParams = new URLSearchParams();

  if (params.viewAllPageId?.trim()) {
    searchParams.set('view_all_page_id', params.viewAllPageId.trim());
    searchParams.set('search_type', 'page');
  } else {
    const q = params.query.trim();
    if (q) searchParams.set('q', q);
    searchParams.set(
      'search_type',
      params.searchType && params.searchType !== 'page' ? params.searchType : 'keyword_unordered'
    );
  }

  searchParams.set('active_status', params.activeStatus ?? 'all');
  searchParams.set('ad_type', params.adCategory === 'political_and_issue_ads' ? 'POLITICAL_AND_ISSUE_ADS' : 'all');
  searchParams.set('country', params.country.trim() || 'ALL');
  searchParams.set('media_type', params.mediaType ?? 'all');

  const platforms = (params.platforms ?? []).map((p) => p.trim().toLowerCase()).filter(Boolean);
  platforms.forEach((p, i) => {
    searchParams.set(`publisher_platforms[${i}]`, p);
  });

  const languages = (params.languages ?? []).map((l) => l.trim()).filter(Boolean);
  languages.forEach((l, i) => {
    searchParams.set(`content_languages[${i}]`, l);
  });

  if (params.startDateMin?.trim()) {
    searchParams.set('start_date[min]', params.startDateMin.trim());
  }
  if (params.startDateMax?.trim()) {
    searchParams.set('start_date[max]', params.startDateMax.trim());
  }

  if (params.sortMode?.trim()) {
    searchParams.set('sort_data[mode]', params.sortMode.trim());
  }

  return `${FB_LIBRARY_BASE}?${searchParams.toString()}`;
}

/** One Facebook library URL per country (Meta search convention). */
export function buildAdsLibraryUrlsForCountries(
  base: Omit<FacebookSearchParams, 'country'>,
  countries: string[]
): string[] {
  const list = countries.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (!list.length) {
    return [buildAdsLibraryUrl({ ...base, country: 'ALL' })];
  }
  return list.map((country) => buildAdsLibraryUrl({ ...base, country }));
}
