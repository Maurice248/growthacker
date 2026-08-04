import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractAdMetaFromRaw } from '@/lib/ads-library/extract-meta';
import type { CompetitorAnalysisInput, ProcessedAdsResult, ProcessedAd } from './types';

function baseFields(ad: ProcessedAd) {
  const copy = ad.copy;
  const script = ad.script;
  const meta = extractAdMetaFromRaw(ad.raw, [
    copy.hook,
    copy.headline,
    copy.body,
    copy.caption,
  ]);
  return {
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

export async function saveScrapedAds(
  companyId: string,
  processed: ProcessedAdsResult,
  input: CompetitorAnalysisInput
): Promise<void> {
  const runKeywords = input.keywords || [];
  const ads = processed.all_ads || [];

  for (const ad of ads) {
    if (!ad.ad_id?.trim()) continue;

    try {
      const existing = await prisma.competitorAd.findUnique({
        where: { companyId_adId: { companyId, adId: ad.ad_id } },
        select: { keywords: true },
      });

      const mergedKeywords = existing
        ? [...new Set([...existing.keywords, ...runKeywords])]
        : runKeywords;

      const fields = baseFields(ad);

      if (existing) {
        await prisma.competitorAd.update({
          where: { companyId_adId: { companyId, adId: ad.ad_id } },
          data: { ...fields, keywords: mergedKeywords },
        });
      } else {
        await prisma.competitorAd.create({
          data: {
            companyId,
            adId: ad.ad_id,
            ...fields,
            keywords: mergedKeywords,
          },
        });
      }
    } catch (err) {
      console.error('[competitor-analysis] save ad failed:', ad.ad_id, err);
    }
  }
}
