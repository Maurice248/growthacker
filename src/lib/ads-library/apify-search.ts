import type { ApifyMetaAdsActorId } from '@/lib/competitor-analysis/apify-actors';
import { getApifyActorSlug, resolveApifyActorId } from '@/lib/competitor-analysis/apify-actors';
import {
  buildApifyRequest,
  normalizeScrapedAdsForProcessing,
} from '@/lib/competitor-analysis/apify';
import type { CompetitorAnalysisInput } from '@/lib/competitor-analysis/types';
import { buildAdsLibraryUrlsForCountries } from '@/lib/ads-library/facebook-url';
import {
  apifyResultsLimitForMaxAds,
  effectiveApifyKeywords,
  facebookSideToSearchParams,
  type FacebookSideParams,
} from '@/lib/ads-library/search-key';

export const DEFAULT_MAX_ADS_LIBRARY_SCRAPE = 100;

export type ApifyRunStartResult = {
  runId: string;
  datasetId: string;
  actorId: ApifyMetaAdsActorId;
};

export type ApifyRunStatusResult = {
  status: string;
  datasetId: string;
  errorMessage?: string;
};

function mediaScrapeFlags(mediaTypes: string[]): { scrape_image: boolean; scrape_video: boolean } {
  if (!mediaTypes.length) return { scrape_image: true, scrape_video: true };
  const set = new Set(mediaTypes.map((t) => t.toLowerCase()));
  if (set.has('video') && !set.has('image') && !set.has('carousel')) {
    return { scrape_image: false, scrape_video: true };
  }
  if ((set.has('image') || set.has('carousel')) && !set.has('video')) {
    return { scrape_image: true, scrape_video: false };
  }
  return { scrape_image: true, scrape_video: true };
}

export function facebookSideToApifyInput(
  fb: FacebookSideParams,
  actorId: ApifyMetaAdsActorId,
  maxAds = fb.maxAds ?? DEFAULT_MAX_ADS_LIBRARY_SCRAPE
): CompetitorAnalysisInput {
  const mapped = facebookSideToSearchParams(fb);
  const { scrape_image, scrape_video } = mediaScrapeFlags(fb.mediaTypes);
  const keywords = effectiveApifyKeywords(fb);
  const limit = apifyResultsLimitForMaxAds(maxAds);

  return {
    keywords,
    countries: mapped.countries,
    max_ads: limit,
    only_active: fb.statusActive && !fb.statusInactive,
    only_inactive: fb.statusInactive && !fb.statusActive,
    view_all_page_id: fb.viewAllPageId.trim() || undefined,
    sort: 'Impressions High → Low',
    apify_actor: actorId,
    scrape_image,
    scrape_video,
  };
}

/** whoareyouanas runs one targetUrl per Apify run; we store run ids joined by comma. */
export async function startAdsLibraryApifyRuns(
  apifyToken: string,
  fb: FacebookSideParams,
  actorId: ApifyMetaAdsActorId
): Promise<ApifyRunStartResult> {
  const actor = resolveApifyActorId(actorId);
  const input = facebookSideToApifyInput(fb, actor);
  const body = buildApifyRequest(input, actor);

  if (actor === 'whoareyouanas') {
    const { targetUrls, ...shared } = body as {
      targetUrls: string[];
      activeStatus: string;
      mediaType: string;
      sortMode: string;
      sortDirection: string;
    };
    const urls = targetUrls?.length ? targetUrls : buildAdsLibraryUrlsForCountries(
      {
        query: input.keywords.join(', '),
        viewAllPageId: fb.viewAllPageId,
        activeStatus: input.only_active ? 'active' : 'all',
        mediaType: 'all',
        languages: fb.languagesInclude,
      },
      input.countries
    );
    const runIds: string[] = [];
    const datasetIds: string[] = [];
    for (const targetUrl of urls) {
      const started = await startActorRun(apifyToken, actor, { targetUrl, ...shared });
      runIds.push(started.runId);
      datasetIds.push(started.datasetId);
    }
    return {
      runId: runIds.join(','),
      datasetId: datasetIds.join(','),
      actorId: actor,
    };
  }

  const started = await startActorRun(apifyToken, actor, body);
  return { ...started, actorId: actor };
}

async function startActorRun(
  apifyToken: string,
  actorId: ApifyMetaAdsActorId,
  body: unknown
): Promise<{ runId: string; datasetId: string }> {
  const slug = getApifyActorSlug(actorId);
  const url = `https://api.apify.com/v2/acts/${slug}/runs?token=${encodeURIComponent(apifyToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Apify start run HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as { data?: { id?: string; defaultDatasetId?: string } };
  const runId = json.data?.id?.trim();
  const datasetId = json.data?.defaultDatasetId?.trim();
  if (!runId || !datasetId) {
    throw new Error('Apify start run returned no run id or dataset id');
  }
  return { runId, datasetId };
}

export async function getApifyRunStatus(
  apifyToken: string,
  runId: string
): Promise<ApifyRunStatusResult> {
  const url = `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(apifyToken)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Apify run status HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as {
    data?: { status?: string; defaultDatasetId?: string; statusMessage?: string };
  };
  return {
    status: json.data?.status ?? 'UNKNOWN',
    datasetId: json.data?.defaultDatasetId ?? '',
    errorMessage: json.data?.statusMessage,
  };
}

export async function pollAllRunsComplete(
  apifyToken: string,
  runIdsCsv: string
): Promise<{ allDone: boolean; anyFailed: boolean; errorMessage: string }> {
  const runIds = runIdsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (!runIds.length) {
    return { allDone: true, anyFailed: true, errorMessage: 'No Apify run id' };
  }

  let anyFailed = false;
  let errorMessage = '';
  for (const runId of runIds) {
    const st = await getApifyRunStatus(apifyToken, runId);
    const status = st.status.toUpperCase();
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      anyFailed = true;
      errorMessage = st.errorMessage || status;
    } else if (status !== 'SUCCEEDED') {
      return { allDone: false, anyFailed: false, errorMessage: '' };
    }
  }
  return { allDone: true, anyFailed, errorMessage };
}

export async function fetchApifyDatasetItems(
  apifyToken: string,
  datasetIdsCsv: string
): Promise<unknown[]> {
  const datasetIds = datasetIdsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  const merged: unknown[] = [];
  for (const datasetId of datasetIds) {
    const items = await fetchSingleDataset(apifyToken, datasetId);
    merged.push(...items);
  }
  return merged;
}

async function fetchSingleDataset(apifyToken: string, datasetId: string): Promise<unknown[]> {
  const out: unknown[] = [];
  let offset = 0;
  const limit = 250;
  for (;;) {
    const url = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(apifyToken)}&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Apify dataset HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const chunk = JSON.parse(text) as unknown[];
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < limit) break;
    offset += chunk.length;
  }
  return out;
}

export function normalizeDatasetForActor(
  rawItems: unknown[],
  actorId: ApifyMetaAdsActorId
): unknown {
  return normalizeScrapedAdsForProcessing(rawItems, actorId);
}
