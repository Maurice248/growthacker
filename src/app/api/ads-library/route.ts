export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  adCreationDateWhere,
  adStatusWhere,
  copyCharRangeWhere,
  copyLengthWhere,
  countriesExcludeWhere,
  countriesIncludeWhere,
  countryWhere,
  createdPresetWhere,
  daysRunningWhere,
  daysRunningRangeWhere,
  languageWhere,
  languagesExcludeWhere,
  languagesIncludeWhere,
  lastSeenDateWhere,
  lastSeenPresetWhere,
  mediaTypesWhere,
  statusCheckboxesWhere,
  videoDurationRangeWhere,
  videoLengthWhere,
  type AdStatusFilter,
  type CopyLengthBucket,
  type DaysRunningBucket,
  type VideoLengthBucket,
} from '@/lib/ads-library/query-filters';
import { isDatePresetId } from '@/lib/ads-library/date-presets';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

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
} satisfies Prisma.CompetitorAdSelect;

type AdLibraryListRow = Prisma.CompetitorAdGetPayload<{ select: typeof AD_LIBRARY_LIST_SELECT }>;

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

function mergeWhere(base: Prisma.CompetitorAdWhereInput, extra: Prisma.CompetitorAdWhereInput) {
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

export async function GET(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { searchParams } = new URL(request.url);
    const adType = searchParams.get('adType')?.trim() || searchParams.get('mediaType')?.trim() || '';
    const angle = searchParams.get('angle')?.trim() || '';
    const country = searchParams.get('country')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const language = searchParams.get('language')?.trim() || '';
    const copyLength = searchParams.get('copyLength')?.trim() || '';
    const videoLength = searchParams.get('videoLength')?.trim() || '';
    const daysRunning = searchParams.get('daysRunning')?.trim() || '';
    const daysRunningMin = searchParams.get('daysRunningMin')?.trim() || '';
    const daysRunningMax = searchParams.get('daysRunningMax')?.trim() || '';
    const createdPreset = searchParams.get('createdPreset')?.trim() || '';
    const lastSeenPreset = searchParams.get('lastSeenPreset')?.trim() || '';
    const createdFrom = searchParams.get('createdFrom')?.trim() || '';
    const createdTo = searchParams.get('createdTo')?.trim() || '';
    const lastSeenFrom = searchParams.get('lastSeenFrom')?.trim() || '';
    const lastSeenTo = searchParams.get('lastSeenTo')?.trim() || '';
    const countriesInclude = searchParams.get('countriesInclude')?.trim() || '';
    const countriesExclude = searchParams.get('countriesExclude')?.trim() || '';
    const languagesInclude = searchParams.get('languagesInclude')?.trim() || '';
    const languagesExclude = searchParams.get('languagesExclude')?.trim() || '';
    const statusActive = searchParams.get('statusActive') === '1';
    const statusInactive = searchParams.get('statusInactive') === '1';
    const copyMin = searchParams.get('copyMin')?.trim() || '';
    const copyMax = searchParams.get('copyMax')?.trim() || '';
    const videoMin = searchParams.get('videoMin')?.trim() || '';
    const videoMax = searchParams.get('videoMax')?.trim() || '';
    const mediaTypes = searchParams.get('mediaTypes')?.trim() || '';
    const q = searchParams.get('q')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );

    const where: Prisma.CompetitorAdWhereInput = { companyId };

    if (adType && adType !== 'all') {
      where.adType = adType;
    }
    const mediaTypeList = mediaTypes
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (mediaTypeList.length) {
      mergeWhere(where, mediaTypesWhere(mediaTypeList));
    }
    if (angle) {
      where.angles = { has: angle };
    }
    const includeCountryList = countriesInclude
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const excludeCountryList = countriesExclude
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (includeCountryList.length) {
      mergeWhere(where, countriesIncludeWhere(includeCountryList));
    } else if (country) {
      mergeWhere(where, countryWhere(country));
    }
    if (excludeCountryList.length) {
      mergeWhere(where, countriesExcludeWhere(excludeCountryList));
    }
    if (statusActive || statusInactive) {
      mergeWhere(where, statusCheckboxesWhere(statusActive, statusInactive));
    } else if (status && STATUS.has(status as AdStatusFilter)) {
      mergeWhere(where, adStatusWhere(status as AdStatusFilter));
    }
    const includeLangList = languagesInclude
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const excludeLangList = languagesExclude
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (includeLangList.length) {
      mergeWhere(where, languagesIncludeWhere(includeLangList));
    } else if (language) {
      mergeWhere(where, languageWhere(language));
    }
    if (excludeLangList.length) {
      mergeWhere(where, languagesExcludeWhere(excludeLangList));
    }
    const copyMinN = copyMin ? parseInt(copyMin, 10) : NaN;
    const copyMaxN = copyMax ? parseInt(copyMax, 10) : NaN;
    if (Number.isFinite(copyMinN) || Number.isFinite(copyMaxN)) {
      mergeWhere(
        where,
        copyCharRangeWhere(
          Number.isFinite(copyMinN) ? copyMinN : undefined,
          Number.isFinite(copyMaxN) ? copyMaxN : undefined
        )
      );
    } else if (copyLength && COPY_LENGTH.has(copyLength as CopyLengthBucket)) {
      mergeWhere(where, copyLengthWhere(copyLength as CopyLengthBucket));
    }
    const videoMinN = videoMin ? parseInt(videoMin, 10) : NaN;
    const videoMaxN = videoMax ? parseInt(videoMax, 10) : NaN;
    if (Number.isFinite(videoMinN) || Number.isFinite(videoMaxN)) {
      mergeWhere(
        where,
        videoDurationRangeWhere(
          Number.isFinite(videoMinN) ? videoMinN : undefined,
          Number.isFinite(videoMaxN) ? videoMaxN : undefined
        )
      );
    } else if (videoLength && VIDEO_LENGTH.has(videoLength as VideoLengthBucket)) {
      mergeWhere(where, videoLengthWhere(videoLength as VideoLengthBucket));
    }
    const daysMinN = daysRunningMin ? parseInt(daysRunningMin, 10) : NaN;
    const daysMaxN = daysRunningMax ? parseInt(daysRunningMax, 10) : NaN;
    if (Number.isFinite(daysMinN) || Number.isFinite(daysMaxN)) {
      mergeWhere(
        where,
        daysRunningRangeWhere(
          Number.isFinite(daysMinN) ? daysMinN : undefined,
          Number.isFinite(daysMaxN) ? daysMaxN : undefined
        )
      );
    } else if (daysRunning && DAYS_RUNNING.has(daysRunning as DaysRunningBucket)) {
      mergeWhere(where, daysRunningWhere(daysRunning as DaysRunningBucket));
    }
    if (createdPreset && isDatePresetId(createdPreset)) {
      mergeWhere(where, createdPresetWhere(createdPreset));
    } else if (createdFrom || createdTo) {
      mergeWhere(where, adCreationDateWhere(createdFrom, createdTo));
    }
    if (lastSeenPreset && isDatePresetId(lastSeenPreset)) {
      mergeWhere(where, lastSeenPresetWhere(lastSeenPreset));
    } else if (lastSeenFrom || lastSeenTo) {
      mergeWhere(where, lastSeenDateWhere(lastSeenFrom, lastSeenTo));
    }

    const terms = q
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const term of terms) {
      mergeWhere(where, {
        OR: [
          { hook: { contains: term, mode: 'insensitive' } },
          { headline: { contains: term, mode: 'insensitive' } },
          { body: { contains: term, mode: 'insensitive' } },
          { cta: { contains: term, mode: 'insensitive' } },
          { pageName: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    const [total, rows, adTypeGroups, facetRows, angleRows] = await Promise.all([
      prisma.competitorAd.count({ where }),
      prisma.competitorAd.findMany({
        where,
        select: AD_LIBRARY_LIST_SELECT,
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.competitorAd.groupBy({
        by: ['adType'],
        where: { companyId },
        _count: { adType: true },
      }),
      prisma.competitorAd.findMany({
        where: { companyId },
        select: { reachCountries: true, languageCode: true },
      }),
      prisma.competitorAd.findMany({
        where: { companyId },
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

    return NextResponse.json({
      ads: rows.map(serializeAdList),
      total,
      page,
      pageSize,
      facets: {
        adTypes: adTypeGroups
          .map((g) => ({ value: g.adType, count: g._count.adType }))
          .sort((a, b) => b.count - a.count),
        countries: [...countrySet].sort((a, b) => a.localeCompare(b)),
        languages: [...languageSet].sort((a, b) => a.localeCompare(b)),
        angles: [...angleSet].sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load ads library';
    console.error('[ads-library]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
