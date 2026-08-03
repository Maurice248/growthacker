export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireApiCompanyId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

type ImpressionsBucket = 'under_1k' | '1k_10k' | '10k_100k' | 'over_100k' | 'unknown';

const IMPRESSIONS_BUCKETS = new Set<ImpressionsBucket>([
  'under_1k',
  '1k_10k',
  '10k_100k',
  'over_100k',
  'unknown',
]);

function impressionsWhere(bucket: ImpressionsBucket): Prisma.CompetitorAdWhereInput {
  switch (bucket) {
    case 'under_1k':
      return {
        OR: [
          { impressionsMax: { lt: 1000 } },
          {
            impressionsMax: null,
            impressionsMin: { lt: 1000, not: null },
          },
        ],
      };
    case '1k_10k':
      return {
        OR: [
          { impressionsMax: { gte: 1000, lt: 10_000 } },
          {
            impressionsMax: null,
            impressionsMin: { gte: 1000, lt: 10_000 },
          },
        ],
      };
    case '10k_100k':
      return {
        OR: [
          { impressionsMax: { gte: 10_000, lt: 100_000 } },
          {
            impressionsMax: null,
            impressionsMin: { gte: 10_000, lt: 100_000 },
          },
        ],
      };
    case 'over_100k':
      return {
        OR: [
          { impressionsMax: { gte: 100_000 } },
          {
            impressionsMax: null,
            impressionsMin: { gte: 100_000 },
          },
        ],
      };
    case 'unknown':
      return { impressionsMin: null, impressionsMax: null };
    default:
      return {};
  }
}

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

export async function GET(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { searchParams } = new URL(request.url);
    const adType = searchParams.get('adType')?.trim() || '';
    const keyword = searchParams.get('keyword')?.trim() || '';
    const angle = searchParams.get('angle')?.trim() || '';
    const impressions = searchParams.get('impressions')?.trim() as ImpressionsBucket | '';
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
    if (keyword) {
      where.keywords = { has: keyword };
    }
    if (angle) {
      where.angles = { has: angle };
    }
    if (impressions && IMPRESSIONS_BUCKETS.has(impressions as ImpressionsBucket)) {
      Object.assign(where, impressionsWhere(impressions as ImpressionsBucket));
    }
    if (q) {
      where.OR = [
        { hook: { contains: q, mode: 'insensitive' } },
        { headline: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { cta: { contains: q, mode: 'insensitive' } },
        { pageName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows, adTypeGroups, keywordRows, angleRows] = await Promise.all([
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
        select: { keywords: true },
      }),
      prisma.competitorAd.findMany({
        where: { companyId },
        select: { angles: true },
      }),
    ]);

    const keywordSet = new Set<string>();
    for (const r of keywordRows) {
      for (const k of r.keywords) keywordSet.add(k);
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
        keywords: [...keywordSet].sort((a, b) => a.localeCompare(b)),
        angles: [...angleSet].sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load ads library';
    console.error('[ads-library]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
