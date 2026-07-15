import { downloadUrl, uploadImageAd } from '../supabase';
import { generateAdMetadata } from '../metadata';
import { requireToken } from '../tokens';
import type { CreateAdTokens, ImageAdConcept, KieTaskResult, ReportData } from '../types';

export type FinalizeImageInput = {
  concept: ImageAdConcept;
  task: KieTaskResult;
};

export async function finalizeImageAds(
  companyId: string,
  tokens: CreateAdTokens,
  items: FinalizeImageInput[],
  reportData: ReportData,
  adsConfig: unknown,
  options: { skipTableInsert?: boolean } = {}
) {
  const results = [];

  for (const { concept, task } of items) {
    if (task.state !== 'success' || !task.resultUrl) {
      results.push({
        id: concept.id,
        success: false,
        error: task.failMsg || 'Image generation failed',
      });
      continue;
    }

    const imageBuffer = await downloadUrl(task.resultUrl);
    const metadataList = await generateAdMetadata(companyId, tokens, reportData, adsConfig, {
      id: concept.id,
      title: concept.title,
      headline: concept.headline,
      cta: concept.cta,
      prompt: concept.prompt,
    });

    const meta = metadataList[0] || {
      ad_id: Number(concept.id),
      ad_type: 'image' as const,
      ad_name: `${concept.title}`,
      primary_text: concept.headline,
      headline: concept.headline,
      ad_description: concept.cta,
      destination_url: '',
    };

    const uploaded = await uploadImageAd(
      companyId,
      imageBuffer,
      {
        ad_id: meta.ad_id,
        ad_type: meta.ad_type,
        ad_name: meta.ad_name,
        primary_text: meta.primary_text,
        headline: meta.headline,
        ad_description: meta.ad_description,
        destination_url: meta.destination_url,
        title: concept.title,
        cta: concept.cta,
        prompt: concept.prompt,
      },
      { skipTableInsert: options.skipTableInsert }
    );

    results.push({
      id: concept.id,
      success: true,
      publicUrl: uploaded.publicUrl,
      row: uploaded.row,
      metadata: meta,
    });
  }

  return results;
}
