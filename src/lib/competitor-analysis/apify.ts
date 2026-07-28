import type { CompetitorAnalysisInput } from './types';

const SORT_MAP: Record<string, string> = {
  'Impressions High → Low': 'impressions_desc',
  'Impressions Low → High': 'impressions_asc',
};

export function resolveAdsLibraryMediaType(
  scrapeImage: boolean | undefined,
  scrapeVideo: boolean | undefined
): 'all' | 'image' | 'video' {
  const image = scrapeImage !== false;
  const video = scrapeVideo !== false;
  if (image && video) return 'all';
  if (image) return 'image';
  if (video) return 'video';
  return 'all';
}

export function buildApifyRequest(input: CompetitorAnalysisInput) {
  const urls: Array<{ url: string }> = [];
  const mediaType = resolveAdsLibraryMediaType(input.scrape_image, input.scrape_video);

  for (const country of input.countries) {
    for (const keyword of input.keywords) {
      const encodedKeyword = encodeURIComponent(keyword);
      urls.push({
        url: `https://www.facebook.com/ads/library/?active_status=${input.only_active ? 'active' : 'all'}&ad_type=all&country=${country}&q=${encodedKeyword}&search_type=keyword_unordered&media_type=${mediaType}`,
      });
    }
  }

  return {
    count: input.max_ads || 100,
    scrapeAdDetails: true,
    'scrapePageAds.activeStatus': input.only_active ? 'active' : 'all',
    'scrapePageAds.countryCode': input.countries[0],
    'scrapePageAds.sortBy': SORT_MAP[input.sort || ''] || 'impressions_desc',
    urls,
  };
}

export async function scrapeFacebookAds(apifyToken: string, body: ReturnType<typeof buildApifyRequest>) {
  const url = `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(290_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Apify returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Apify returned invalid JSON: ${text.slice(0, 200)}`);
  }

  return data;
}
