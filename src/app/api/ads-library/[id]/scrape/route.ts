export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  APIFY_META_ADS_ACTORS,
  resolveApifyActorId,
} from '@/lib/competitor-analysis/apify-actors';
import { scrapeSingleAdLibraryAd } from '@/lib/competitor-analysis/apify';
import { prisma } from '@/lib/prisma';

function previewImageFromRaw(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  const ad = raw as Record<string, unknown>;
  const snapshot = (ad.snapshot || {}) as Record<string, unknown>;

  const fromImages = (images: Record<string, unknown>[]) => {
    for (const img of images) {
      const url = img.original_image_url || img.resized_image_url || img.url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
    return '';
  };

  const fromVideos = (videos: Record<string, unknown>[]) => {
    for (const vid of videos) {
      const url = vid.video_preview_image_url || vid.thumbnail || vid.url;
      if (typeof url === 'string' && url.trim()) return url.trim();
    }
    return '';
  };

  return (
    fromImages((snapshot.images || []) as Record<string, unknown>[]) ||
    fromVideos((snapshot.videos || []) as Record<string, unknown>[]) ||
    fromImages((snapshot.cards || []) as Record<string, unknown>[])
  );
}

export async function POST(
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

    if (!row.adId?.trim()) {
      return NextResponse.json({ error: 'Ad has no Meta library ID to scrape.' }, { status: 400 });
    }

    const secrets = await getCompanyApiTokenSecrets(companyId);
    const apifyToken = secrets.apify?.trim();
    if (!apifyToken) {
      return NextResponse.json(
        { error: 'Apify API token is not configured. Add it under Integrations → Apify.' },
        { status: 503 }
      );
    }

    const actorId = resolveApifyActorId(secrets.adsLibraryApifyActor);
    const actorLabel = APIFY_META_ADS_ACTORS.find((a) => a.id === actorId)?.label ?? actorId;

    const raw = await scrapeSingleAdLibraryAd(apifyToken, actorId, row.adId);
    if (raw == null || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length === 0)) {
      return NextResponse.json(
        { error: 'Apify returned no data for this ad. The ad may have been removed from the Ads Library.' },
        { status: 404 }
      );
    }

    const imageUrl = previewImageFromRaw(raw) || row.imageUrl;

    // Persist full actor payload only — not tied to Ads Library filter facets.
    await prisma.competitorAd.update({
      where: { id: row.id },
      data: {
        raw: raw as Prisma.InputJsonValue,
        ...(imageUrl ? { imageUrl } : {}),
      },
    });

    return NextResponse.json({
      raw,
      imageUrl,
      actorId,
      actorLabel,
      adId: row.adId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to scrape ad';
    console.error('[ads-library/scrape]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
