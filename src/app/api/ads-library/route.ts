export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireApiCompanyId } from '@/lib/api-auth';
import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import {
  adStatusWhere,
  copyCharRangeWhere,
  copyLengthWhere,
  countriesExcludeWhere,
  countryWhere,
  daysRunningWhere,
  daysRunningRangeWhere,
  languageWhere,
  languagesExcludeWhere,
  lastSeenDateWhere,
  lastSeenPresetWhere,
  videoDurationRangeWhere,
  videoLengthWhere,
  type AdStatusFilter,
  type CopyLengthBucket,
  type DaysRunningBucket,
  type VideoLengthBucket,
} from '@/lib/ads-library/query-filters';
import { isDatePresetId, resolveDatePresetRange } from '@/lib/ads-library/date-presets';
import {
  computeSearchKey,
  facebookSideHasSearchCriteria,
  facebookSideToSearchParams,
  parseAdsLibrarySearchParams,
  type LocalRefinementParams,
} from '@/lib/ads-library/search-key';
import {
  fetchAndIngestSearchDataset,
} from '@/lib/ads-library/ingest';
import {
  pollAllRunsComplete,
  startAdsLibraryApifyRuns,
  getApifyRunStatus,
} from '@/lib/ads-library/apify-search';
import { extractPreviewImageFromRaw } from '@/lib/ads-library/view-ads';
import { resolveApifyActorId, DEFAULT_APIFY_META_ADS_ACTOR } from '@/lib/competitor-analysis/apify-actors';
import { prisma } from '@/lib/prisma';

export const SEARCH_TTL_MS = 15 * 60 * 1000;

const COPY_LENGTH = new Set<CopyLengthBucket>(['short', 'medium', 'long']);
const VIDEO_LENGTH = new Set<VideoLengthBucket>(['none', 'short', 'medium', 'long']);
const DAYS_RUNNING = new Set<DaysRunningBucket>(['under_7', '7_30', '30_90', 'over_90']);
const STATUS = new Set<AdStatusFilter>(['active', 'inactive']);

const AD_LIBRARY_LIST_SELECT = {
  id: true,
  adId: true,
  pageName: true,
  pageUrl: true,
  adType: true,
  startDate: true,
  platforms: true,
  hook: true,
  headline: true,
  body: true,
  cta: true,
  caption: true,
  framework: true,
  angles: true,
  hashtags: true,
  keywords: true,
  strength: true,
  score: true,
  imageUrl: true,
  hasVideo: true,
  impressionsText: true,
  impressionsMin: true,
  impressionsMax: true,
  firstSeenAt: true,
  lastSeenAt: true,
} satisfies Prisma.AdLibraryAdSelect;

type AdLibraryListRow = Prisma.AdLibraryAdGetPayload<{ select: typeof AD_LIBRARY_LIST_SELECT }>;

function serializeAdList(row: AdLibraryListRow) {
  return {
    id: row.id,
    adId: row.adId,
    pageName: row.pageName,
    pageUrl: row.pageUrl,
    adType: row.adType,
    startDate: row.startDate,
    platforms: row.platforms,
    hook: row.hook,
    headline: row.headline,
    body: row.body,
    cta: row.cta,
    caption: row.caption,
    framework: row.framework,
    angles: row.angles,
    hashtags: row.hashtags,
    keywords: row.keywords,
    strength: row.strength,
    score: row.score,
    imageUrl: row.imageUrl,
    hasVideo: row.hasVideo,
    impressionsText: row.impressionsText,
    impressionsMin: row.impressionsMin,
    impressionsMax: row.impressionsMax,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

function mergeWhere(base: Prisma.AdLibraryAdWhereInput, extra: Prisma.AdLibraryAdWhereInput) {
  const keys = Object.keys(extra);
  if (keys.length === 0) return;
  if (!base.AND) {
    base.AND = [extra];
    return;
  }
  if (Array.isArray(base.AND)) {
    base.AND.push(extra);
  } else {
    base.AND = [base.AND, extra];
  }
}

function buildLocalWhere(local: LocalRefinementParams): Prisma.AdLibraryAdWhereInput {
  const where: Prisma.AdLibraryAdWhereInput = {};

  const adType = local.adType;
  if (adType && adType !== 'all') {
    where.adType = adType;
  }
  if (local.angle) {
    where.angles = { has: local.angle };
  }

  const excludeCountryList = local.countriesExclude;
  if (excludeCountryList.length) {
    mergeWhere(where, countriesExcludeWhere(excludeCountryList));
  } else if (local.country) {
    mergeWhere(where, countryWhere(local.country));
  }

  if (local.status && STATUS.has(local.status as AdStatusFilter)) {
    mergeWhere(where, adStatusWhere(local.status as AdStatusFilter));
  }

  const excludeLangList = local.languagesExclude;
  if (excludeLangList.length) {
    mergeWhere(where, languagesExcludeWhere(excludeLangList));
  } else if (local.language) {
    mergeWhere(where, languageWhere(local.language));
  }

  const copyMinN = local.copyMin ? parseInt(local.copyMin, 10) : NaN;
  const copyMaxN = local.copyMax ? parseInt(local.copyMax, 10) : NaN;
  if (Number.isFinite(copyMinN) || Number.isFinite(copyMaxN)) {
    mergeWhere(
      where,
      copyCharRangeWhere(
        Number.isFinite(copyMinN) ? copyMinN : undefined,
        Number.isFinite(copyMaxN) ? copyMaxN : undefined
      )
    );
  } else if (local.copyLength && COPY_LENGTH.has(local.copyLength as CopyLengthBucket)) {
    mergeWhere(where, copyLengthWhere(local.copyLength as CopyLengthBucket));
  }

  const videoMinN = local.videoMin ? parseInt(local.videoMin, 10) : NaN;
  const videoMaxN = local.videoMax ? parseInt(local.videoMax, 10) : NaN;
  if (Number.isFinite(videoMinN) || Number.isFinite(videoMaxN)) {
    mergeWhere(
      where,
      videoDurationRangeWhere(
        Number.isFinite(videoMinN) ? videoMinN : undefined,
        Number.isFinite(videoMaxN) ? videoMaxN : undefined
      )
    );
  } else if (local.videoLength && VIDEO_LENGTH.has(local.videoLength as VideoLengthBucket)) {
    mergeWhere(where, videoLengthWhere(local.videoLength as VideoLengthBucket));
  }

  const daysMinN = local.daysRunningMin ? parseInt(local.daysRunningMin, 10) : NaN;
  const daysMaxN = local.daysRunningMax ? parseInt(local.daysRunningMax, 10) : NaN;
  if (Number.isFinite(daysMinN) || Number.isFinite(daysMaxN)) {
    mergeWhere(
      where,
      daysRunningRangeWhere(
        Number.isFinite(daysMinN) ? daysMinN : undefined,
        Number.isFinite(daysMaxN) ? daysMaxN : undefined
      )
    );
  } else if (local.daysRunning && DAYS_RUNNING.has(local.daysRunning as DaysRunningBucket)) {
    mergeWhere(where, daysRunningWhere(local.daysRunning as DaysRunningBucket));
  }

  if (local.lastSeenPreset && isDatePresetId(local.lastSeenPreset)) {
    mergeWhere(where, lastSeenPresetWhere(local.lastSeenPreset));
  } else if (local.lastSeenFrom || local.lastSeenTo) {
    mergeWhere(where, lastSeenDateWhere(local.lastSeenFrom, local.lastSeenTo));
  }

  const terms = local.qExtra
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  // Search keywords are applied in the Facebook/Apify scrape already.
  // Do not re-filter by copy text here — many valid library ads won't contain the
  // keyword in hook/body/pageName even when Meta returned them for that query.
  void terms;

  return where;
}

function searchIsFresh(
  finishedAt: Date | null | undefined,
  totalFound?: number | null
): boolean {
  if (!finishedAt) return false;
  if (SEARCH_TTL_MS <= 0) return false;
  // Empty scrapes must not be cached — retry on the next request.
  if (totalFound == null || totalFound <= 0) return false;
  return Date.now() - finishedAt.getTime() < SEARCH_TTL_MS;
}

async function serveSearchResults(
  companyId: string,
  searchId: string,
  local: LocalRefinementParams,
  page: number,
  pageSize: number
) {
  const localWhere = buildLocalWhere(local);
  const where: Prisma.AdLibraryAdWhereInput = {
    companyId,
    searchHits: { some: { searchId } },
    ...localWhere,
  };

  const [total, rows, adTypeGroups, facetRows, angleRows] = await Promise.all([
    prisma.adLibraryAd.count({ where }),
    prisma.adLibraryAd.findMany({
      where,
      select: AD_LIBRARY_LIST_SELECT,
      orderBy: [{ score: 'desc' }, { impressionsMax: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.adLibraryAd.groupBy({
      by: ['adType'],
      where: { companyId, searchHits: { some: { searchId } } },
      _count: { adType: true },
    }),
    prisma.adLibraryAd.findMany({
      where: { companyId, searchHits: { some: { searchId } } },
      select: { reachCountries: true, languageCode: true },
    }),
    prisma.adLibraryAd.findMany({
      where: { companyId, searchHits: { some: { searchId } } },
      select: { angles: true },
    }),
  ]);

  const countrySet = new Set<string>();
  const languageSet = new Set<string>();
  for (const r of facetRows) {
    for (const c of r.reachCountries) countrySet.add(c);
    if (r.languageCode) languageSet.add(r.languageCode);
  }
  const angleSet = new Set<string>();
  for (const r of angleRows) {
    for (const a of r.angles) angleSet.add(a);
  }

  // Backfill missing thumbnails (e.g. carousels stored before cards were read).
  const missingPreviewIds = rows.filter((r) => !r.imageUrl?.trim()).map((r) => r.id);
  const previewById = new Map<string, string>();
  if (missingPreviewIds.length > 0) {
    const rawRows = await prisma.adLibraryAd.findMany({
      where: { id: { in: missingPreviewIds } },
      select: { id: true, raw: true },
    });
    const updates: Array<{ id: string; imageUrl: string }> = [];
    for (const r of rawRows) {
      const imageUrl = extractPreviewImageFromRaw(r.raw);
      if (!imageUrl) continue;
      previewById.set(r.id, imageUrl);
      updates.push({ id: r.id, imageUrl });
    }
    if (updates.length > 0) {
      await Promise.all(
        updates.map((u) =>
          prisma.adLibraryAd.update({
            where: { id: u.id },
            data: { imageUrl: u.imageUrl },
          })
        )
      );
    }
  }

  return {
    ads: rows.map((row) =>
      serializeAdList({
        ...row,
        imageUrl: row.imageUrl?.trim() || previewById.get(row.id) || row.imageUrl,
      })
    ),
    total,
    page,
    pageSize,
    status: 'succeeded' as const,
    facets: {
      adTypes: adTypeGroups
        .map((g) => ({ value: g.adType, count: g._count.adType }))
        .sort((a, b) => b.count - a.count),
      countries: [...countrySet].sort((a, b) => a.localeCompare(b)),
      languages: [...languageSet].sort((a, b) => a.localeCompare(b)),
      angles: [...angleSet].sort((a, b) => a.localeCompare(b)),
    },
  };
}

export async function GET(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const parsed = parseAdsLibrarySearchParams(new URL(request.url).searchParams);
    const { facebook: fb, local, page, pageSize } = parsed;

    if (!facebookSideHasSearchCriteria(fb)) {
      return NextResponse.json({
        ads: [],
        total: 0,
        page,
        pageSize,
        status: 'idle',
        facets: { adTypes: [], countries: [], languages: [], angles: [] },
      });
    }

    const searchKey = computeSearchKey(fb);
    const mapped = facebookSideToSearchParams(fb);
    const created =
      fb.createdPreset && isDatePresetId(fb.createdPreset)
        ? resolveDatePresetRange(fb.createdPreset)
        : { from: fb.createdFrom, to: fb.createdTo };

    let search = await prisma.adLibrarySearch.findUnique({
      where: { companyId_searchKey: { companyId, searchKey } },
    });

    const secrets = await getCompanyApiTokenSecrets(companyId);
    const apifyToken = secrets.apify?.trim();
    const actorId = resolveApifyActorId(secrets.adsLibraryApifyActor);

    const needsNewRun =
      !search ||
      search.status === 'failed' ||
      !search.apifyRunId?.trim() ||
      (search.status === 'succeeded' && !searchIsFresh(search.finishedAt, search.totalFound));

    if (needsNewRun) {
      if (!apifyToken) {
        return NextResponse.json(
          {
            error: 'Apify API token is not configured. Add it under Integrations → Apify.',
          },
          { status: 503 }
        );
      }

      const started = await startAdsLibraryApifyRuns(apifyToken, fb, actorId);

      search = await prisma.adLibrarySearch.upsert({
        where: { companyId_searchKey: { companyId, searchKey } },
        create: {
          companyId,
          searchKey,
          query: fb.queryTerms.join(', '),
          searchType: fb.viewAllPageId ? 'page' : 'keyword_unordered',
          viewAllPageId: fb.viewAllPageId,
          countries: mapped.countries,
          activeStatus: mapped.activeStatus ?? 'all',
          mediaType: mapped.mediaType ?? 'all',
          languages: fb.languagesInclude,
          startDateMin: created.from,
          startDateMax: created.to,
          actorId,
          apifyRunId: started.runId,
          apifyDatasetId: started.datasetId,
          status: 'running',
          totalFound: 0,
          error: '',
        },
        update: {
          query: fb.queryTerms.join(', '),
          countries: mapped.countries,
          activeStatus: mapped.activeStatus ?? 'all',
          mediaType: mapped.mediaType ?? 'all',
          languages: fb.languagesInclude,
          startDateMin: created.from,
          startDateMax: created.to,
          actorId,
          apifyRunId: started.runId,
          apifyDatasetId: started.datasetId,
          status: 'running',
          totalFound: 0,
          error: '',
          finishedAt: null,
        },
      });

      await prisma.adLibrarySearchHit.deleteMany({ where: { searchId: search.id } });

      return NextResponse.json({
        ads: [],
        total: 0,
        page,
        pageSize,
        status: 'running',
        facets: { adTypes: [], countries: [], languages: [], angles: [] },
      });
    }

    if (search.status === 'running' || search.status === 'queued') {
      if (!apifyToken) {
        return NextResponse.json(
          { error: 'Apify API token is not configured.' },
          { status: 503 }
        );
      }

      const poll = await pollAllRunsComplete(apifyToken, search.apifyRunId);
      if (!poll.allDone) {
        return NextResponse.json({
          ads: [],
          total: 0,
          page,
          pageSize,
          status: 'running',
          facets: { adTypes: [], countries: [], languages: [], angles: [] },
        });
      }

      if (poll.anyFailed) {
        await prisma.adLibrarySearch.update({
          where: { id: search.id },
          data: {
            status: 'failed',
            error: poll.errorMessage || 'Apify run failed',
            finishedAt: new Date(),
          },
        });
        return NextResponse.json(
          { error: poll.errorMessage || 'Facebook Ads Library scrape failed' },
          { status: 502 }
        );
      }

      // Refresh dataset id from Apify in case the stored value is stale/empty.
      const primaryRunId = search.apifyRunId.split(',')[0]?.trim();
      if (primaryRunId) {
        const st = await getApifyRunStatus(apifyToken, primaryRunId);
        if (st.datasetId && st.datasetId !== search.apifyDatasetId.split(',')[0]) {
          search = await prisma.adLibrarySearch.update({
            where: { id: search.id },
            data: { apifyDatasetId: st.datasetId },
          });
        }
      }

      let usedActor = resolveApifyActorId(search.actorId);
      let totalFound = await fetchAndIngestSearchDataset(
        companyId,
        search.id,
        apifyToken,
        search.apifyDatasetId,
        usedActor,
        fb.queryTerms,
        fb,
        fb.maxAds
      );

      // Official Meta actor often returns empty for keyword library URLs — fall back once.
      if (totalFound === 0 && usedActor === 'apify_official') {
        console.warn(
          '[ads-library] apify_official returned 0 ads; retrying with curious_coder'
        );
        const fallback = await startAdsLibraryApifyRuns(
          apifyToken,
          fb,
          DEFAULT_APIFY_META_ADS_ACTOR
        );
        search = await prisma.adLibrarySearch.update({
          where: { id: search.id },
          data: {
            actorId: fallback.actorId,
            apifyRunId: fallback.runId,
            apifyDatasetId: fallback.datasetId,
            status: 'running',
            totalFound: 0,
            error: '',
            finishedAt: null,
          },
        });
        return NextResponse.json({
          ads: [],
          total: 0,
          page,
          pageSize,
          status: 'running',
          facets: { adTypes: [], countries: [], languages: [], angles: [] },
        });
      }

      if (totalFound === 0) {
        await prisma.adLibrarySearch.update({
          where: { id: search.id },
          data: {
            status: 'failed',
            totalFound: 0,
            finishedAt: new Date(),
            error:
              'Apify returned no ads for this search. Try curious_coder under Integrations → Apify, or a different keyword/country.',
          },
        });
        return NextResponse.json(
          {
            error:
              'No ads were returned from Meta Ads Library for this filter set. Try another keyword, or set Ads Library actor to curious_coder in Integrations → Apify.',
          },
          { status: 502 }
        );
      }

      await prisma.adLibrarySearch.update({
        where: { id: search.id },
        data: {
          status: 'succeeded',
          totalFound,
          finishedAt: new Date(),
          error: '',
        },
      });

      search = await prisma.adLibrarySearch.findUniqueOrThrow({ where: { id: search.id } });
    }

    if (search.status === 'failed') {
      return NextResponse.json(
        { error: search.error || 'Facebook Ads Library scrape failed' },
        { status: 502 }
      );
    }

    const payload = await serveSearchResults(companyId, search.id, local, page, pageSize);
    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load ads library';
    console.error('[ads-library]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
