import { chatCompletionJson } from './openai';
import {
  buildMetadataSystemPrompt,
  buildMetadataUserPrompt,
} from './prompts';
import { resolveCreateAdCompanyContext } from './company-context';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import type { AdMetadata, CreateAdTokens, ReportData } from './types';

export async function generateAdMetadata(
  companyId: string,
  tokens: CreateAdTokens,
  reportData: ReportData,
  adsConfig: unknown,
  imageMeta?: Record<string, unknown>
): Promise<AdMetadata[]> {
  const ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  const ctx = await resolveCreateAdCompanyContext(companyId);

  const cleanData = JSON.stringify({
    ...reportData,
    ads_config: adsConfig,
  })
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parsed = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: buildMetadataSystemPrompt(ctx) },
      { role: 'user', content: buildMetadataUserPrompt(cleanData, imageMeta) },
    ],
    { model: 'gpt-4o', jsonMode: true }
  );

  const ads = (parsed.ads as AdMetadata[]) || [];
  return ads.map((ad) => ({
    ...ad,
    destination_url: ad.destination_url || ctx.destinationUrl,
  }));
}
