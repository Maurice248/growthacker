import type { CompetitorAnalysisInput } from './types';
import {
  getApifyActorSlug,
  resolveApifyActorId,
  type ApifyMetaAdsActorId,
} from './apify-actors';

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

export function buildAdsLibrarySearchUrls(input: CompetitorAnalysisInput): string[] {
  const urls: string[] = [];
  const mediaType = resolveAdsLibraryMediaType(input.scrape_image, input.scrape_video);

  for (const country of input.countries) {
    for (const keyword of input.keywords) {
      const encodedKeyword = encodeURIComponent(keyword);
      urls.push(
        `https://www.facebook.com/ads/library/?active_status=${input.only_active ? 'active' : 'all'}&ad_type=all&country=${country}&q=${encodedKeyword}&search_type=keyword_unordered&media_type=${mediaType}`
      );
    }
  }

  return urls;
}

function mapOfficialSorting(sort: string | undefined): string {
  if (sort === 'Newest First') return 'most_recent';
  if (sort === 'Impressions Low → High') return 'impressions_low_to_high';
  return 'impressions_high_to_low';
}

function mapWhoareyouanasSort(sort: string | undefined): {
  sortMode: string;
  sortDirection: string;
} {
  if (sort === 'Newest First') {
    return { sortMode: 'start_date', sortDirection: 'desc' };
  }
  return { sortMode: 'total_impressions', sortDirection: 'desc' };
}

export function buildApifyRequest(input: CompetitorAnalysisInput, actorId?: ApifyMetaAdsActorId) {
  const actor = resolveApifyActorId(actorId ?? input.apify_actor);
  const urls = buildAdsLibrarySearchUrls(input);
  const mediaType = resolveAdsLibraryMediaType(input.scrape_image, input.scrape_video);
  const activeStatus = input.only_active ? 'active' : 'all';
  const maxAds = input.max_ads || 100;

  if (actor === 'apify_official') {
    return {
      startUrls: urls.map((url) => ({ url })),
      resultsLimit: maxAds,
      activeStatus,
      sorting: mapOfficialSorting(input.sort),
      isDetailsPerAd: true,
    };
  }

  if (actor === 'whoareyouanas') {
    const { sortMode, sortDirection } = mapWhoareyouanasSort(input.sort);
    return {
      targetUrls: urls,
      activeStatus,
      mediaType,
      sortMode,
      sortDirection,
    };
  }

  return {
    count: maxAds,
    scrapeAdDetails: true,
    'scrapePageAds.activeStatus': activeStatus,
    'scrapePageAds.countryCode': input.countries[0],
    'scrapePageAds.sortBy': SORT_MAP[input.sort || ''] || 'impressions_desc',
    urls: urls.map((url) => ({ url })),
  };
}

function flattenDatasetItems(raw: unknown): Record<string, unknown>[] {
  const items = Array.isArray(raw) ? raw : [raw];
  const ads: Record<string, unknown>[] = [];

  for (const item of items) {
    const b = item as Record<string, unknown>;
    if (Array.isArray(b)) ads.push(...(b as Record<string, unknown>[]));
    else if (Array.isArray(b?.results)) ads.push(...(b.results as Record<string, unknown>[]));
    else if (Array.isArray(b?.data)) ads.push(...(b.data as Record<string, unknown>[]));
    else if (typeof b?.allAds === 'string') {
      try {
        const parsed = JSON.parse(b.allAds as string) as unknown;
        if (Array.isArray(parsed)) ads.push(...(parsed as Record<string, unknown>[]));
      } catch {
        /* ignore malformed allAds */
      }
    } else if (Array.isArray(b?.allAds)) {
      ads.push(...(b.allAds as Record<string, unknown>[]));
    } else if (b) ads.push(b);
  }

  return ads;
}

function normalizeWhoareyouanasAd(ad: Record<string, unknown>): Record<string, unknown> {
  if (ad.snapshot && (ad.page_name || ad.advertiser_name || ad.ad_archive_id)) {
    return ad;
  }

  const images = ((ad.images || []) as Record<string, unknown>[]).map((img) => ({
    original_image_url: img.url || img.original_image_url,
    url: img.url || img.original_image_url,
  }));
  const videos = ((ad.videos || []) as Record<string, unknown>[]).map((vid) => ({
    video_preview_image_url: vid.url || vid.thumbnail,
  }));

  return {
    ad_archive_id: ad.libraryID || ad.ad_archive_id || ad.id,
    page_name: ad.brand || ad.page_name,
    advertiser_name: ad.brand || ad.advertiser_name,
    start_date: ad.startDate || ad.start_date,
    publisher_platforms: ad.platforms || ad.publisher_platforms,
    snapshot: {
      body: ad.body || '',
      title: ad.linkTitle || ad.title || '',
      headline: ad.linkTitle || ad.title || '',
      cta_text: ad.ctaText || ad.cta_text || '',
      caption: ad.linkDescription || ad.link_description || '',
      images,
      videos,
    },
    actor_payload: ad,
  };
}

export function normalizeScrapedAdsForProcessing(
  raw: unknown,
  actorId?: ApifyMetaAdsActorId
): unknown {
  const actor = resolveApifyActorId(actorId);
  if (actor !== 'whoareyouanas') return raw;

  const flat = flattenDatasetItems(raw);
  return flat.map((ad) => normalizeWhoareyouanasAd(ad));
}

async function runSyncActor(apifyToken: string, actorSlug: string, body: unknown) {
  const url = `https://api.apify.com/v2/acts/${actorSlug}/run-sync-get-dataset-items?token=${encodeURIComponent(apifyToken)}`;

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

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Apify returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

export async function scrapeFacebookAds(
  apifyToken: string,
  input: CompetitorAnalysisInput,
  body?: ReturnType<typeof buildApifyRequest>
) {
  const actor = resolveApifyActorId(input.apify_actor);
  const actorSlug = getApifyActorSlug(actor);
  const requestBody = body ?? buildApifyRequest(input, actor);

  if (actor === 'whoareyouanas') {
    const { targetUrls, ...shared } = requestBody as {
      targetUrls: string[];
      activeStatus: string;
      mediaType: string;
      sortMode: string;
      sortDirection: string;
    };
    const merged: unknown[] = [];
    for (const targetUrl of targetUrls) {
      const chunk = await runSyncActor(apifyToken, actorSlug, {
        targetUrl,
        ...shared,
      });
      merged.push(...flattenDatasetItems(chunk));
    }
    return normalizeScrapedAdsForProcessing(merged, actor);
  }

  const scraped = await runSyncActor(apifyToken, actorSlug, requestBody);
  return normalizeScrapedAdsForProcessing(scraped, actor);
}
