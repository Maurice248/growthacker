import { Prisma } from '@prisma/client';
import type { ApifyMetaAdsActorId } from '@/lib/competitor-analysis/apify-actors';
import { processScrapedAds } from '@/lib/competitor-analysis/process-ads';
import type { ProcessedAd } from '@/lib/competitor-analysis/types';
import { extractAdMetaFromRaw } from '@/lib/ads-library/extract-meta';
import type { FacebookSideParams } from '@/lib/ads-library/search-key';
import {
  fetchApifyDatasetItems,
  normalizeDatasetForActor,
} from '@/lib/ads-library/apify-search';
import { prisma } from '@/lib/prisma';

function safePageId(raw: Record<string, unknown> | undefined): string {
  if (!raw) return '';
  const id = raw.page_id ?? raw.pageId ?? raw.advertiser_id;
  return id != null ? String(id).trim() : '';
}

function baseFields(ad: ProcessedAd) {
  const copy = ad.copy;
  const script = ad.script;
  const meta = extractAdMetaFromRaw(ad.raw, [
    copy.hook,
    copy.headline,
    copy.body,
    copy.caption,
  ]);
  const rawObj = ad.raw && typeof ad.raw === 'object' && !Array.isArray(ad.raw)
    ? (ad.raw as Record<string, unknown>)
    : undefined;

  return {
    pageId: safePageId(rawObj),
    pageName: ad.page_name,
    pageUrl: ad.page_url,
    adType: ad.ad_type,
    startDate: ad.start_date,
    platforms: ad.platforms,
    hook: copy.hook,
    headline: copy.headline,
    body: copy.body,
    cta: copy.cta,
    caption: copy.caption,
    framework: script.framework,
    angles: ad.angles,
    hashtags: ad.hashtags,
    strength: ad.strength,
    score: ad.score,
    imageUrl: ad.image_url,
    hasVideo: ad.has_video,
    impressionsText: ad.impressions_text ?? null,
    impressionsMin: ad.impressions_min ?? null,
    impressionsMax: ad.impressions_max ?? null,
    reachCountries: meta.reachCountries,
    adActive: meta.adActive,
    languageCode: meta.languageCode,
    videoDurationSec: meta.videoDurationSec,
    copyCharCount: meta.copyCharCount,
    raw: ad.raw ? (ad.raw as Prisma.InputJsonValue) : Prisma.JsonNull,
  };
}

function matchesFacebookSideFilters(ad: ProcessedAd, fb: FacebookSideParams): boolean {
  const copy = ad.copy;
  const meta = extractAdMetaFromRaw(ad.raw, [
    copy.hook,
    copy.headline,
    copy.body,
    copy.caption,
  ]);

  if (fb.statusActive && !fb.statusInactive && meta.adActive === false) return false;
  if (fb.statusInactive && !fb.statusActive && meta.adActive === true) return false;

  // Country is already constrained by the Facebook library URL. Reach metadata is often
  // missing on scraped rows — do not drop ads when reachCountries is empty/unknown.
  void fb.countriesInclude;
  void meta.reachCountries;

  if (fb.languagesInclude.length > 0) {
    const lang = meta.languageCode.toLowerCase();
    const wanted = fb.languagesInclude.map((l) => l.toLowerCase());
    if (lang && !wanted.includes(lang)) return false;
  }

  return true;
}

function rankAdsForTopN(ads: ProcessedAd[]): ProcessedAd[] {
  return [...ads].sort((a, b) => {
    const impA = a.impressions_max ?? a.impressions_min ?? 0;
    const impB = b.impressions_max ?? b.impressions_min ?? 0;
    if (impB !== impA) return impB - impA;
    return b.score - a.score;
  });
}

export async function ingestScrapedAdsForSearch(
  companyId: string,
  searchId: string,
  raw: unknown,
  searchKeywords: string[],
  fb: FacebookSideParams,
  maxAds: number
): Promise<number> {
  const processed = processScrapedAds(raw, [], { libraryMode: true });
  let ads = (processed.all_ads || []).filter((ad) => matchesFacebookSideFilters(ad, fb));
  ads = rankAdsForTopN(ads).slice(0, Math.max(1, maxAds));

  let position = 0;

  for (const ad of ads) {
    if (!ad.ad_id?.trim()) continue;

    try {
      const fields = baseFields(ad);
      const mergedKeywords = searchKeywords.length ? [...searchKeywords] : [];

      const existing = await prisma.adLibraryAd.findUnique({
        where: { companyId_adId: { companyId, adId: ad.ad_id } },
        select: { id: true, keywords: true },
      });

      const mergedKw = existing
        ? [...new Set([...existing.keywords, ...mergedKeywords])]
        : mergedKeywords;

      const row = existing
        ? await prisma.adLibraryAd.update({
            where: { id: existing.id },
            data: { ...fields, keywords: mergedKw },
          })
        : await prisma.adLibraryAd.create({
            data: {
              companyId,
              adId: ad.ad_id,
              ...fields,
              keywords: mergedKw,
            },
          });

      await prisma.adLibrarySearchHit.upsert({
        where: {
          searchId_adLibraryAdId: { searchId, adLibraryAdId: row.id },
        },
        create: {
          searchId,
          adLibraryAdId: row.id,
          position,
        },
        update: { position },
      });
      position += 1;
    } catch (err) {
      console.error('[ads-library/ingest] save ad failed:', ad.ad_id, err);
    }
  }

  return position;
}

export async function fetchAndIngestSearchDataset(
  companyId: string,
  searchId: string,
  apifyToken: string,
  datasetIdsCsv: string,
  actorId: ApifyMetaAdsActorId,
  searchKeywords: string[],
  fb: FacebookSideParams,
  maxAds: number
): Promise<number> {
  const items = await fetchApifyDatasetItems(apifyToken, datasetIdsCsv);
  console.info(
    `[ads-library/ingest] actor=${actorId} datasetItems=${items.length} keywords=${searchKeywords.join(',')}`
  );
  const normalized = normalizeDatasetForActor(items, actorId);
  return ingestScrapedAdsForSearch(
    companyId,
    searchId,
    normalized,
    searchKeywords,
    fb,
    maxAds
  );
}
