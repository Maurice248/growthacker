export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

function serializeAd(row: {
  id: string;
  adId: string;
  pageName: string;
  pageUrl: string;
  adType: string;
  startDate: string;
  platforms: string;
  hook: string;
  headline: string;
  body: string;
  cta: string;
  caption: string;
  framework: string;
  angles: string[];
  hashtags: string[];
  keywords: string[];
  strength: string;
  score: number;
  imageUrl: string;
  hasVideo: boolean;
  impressionsText: string | null;
  impressionsMin: number | null;
  impressionsMax: number | null;
  raw: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
}) {
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
    raw: row.raw,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { id } = await context.params;
    const row = await prisma.competitorAd.findFirst({
      where: { id, companyId },
    });

    if (!row) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    return NextResponse.json(serializeAd(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load ad details';
    console.error('[ads-library/id]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
