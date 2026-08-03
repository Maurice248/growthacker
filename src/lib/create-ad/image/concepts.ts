import { chatCompletionJson } from '@/lib/create-ad/openai';
import {
  buildImageAdConceptsSystemPrompt,
  buildImageAdConceptsUserPrompt,
  buildStructurizerSystemPrompt,
  buildStructurizerUserPrompt,
} from '@/lib/create-ad/prompts';
import { resolveCreateAdCompanyContext } from '@/lib/create-ad/company-context';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import type { AdItemInput, CreateAdTokens, ImageAdConcept, ReportData } from '@/lib/create-ad/types';

export async function structurizeReport(
  companyId: string,
  tokens: CreateAdTokens,
  reportData: ReportData,
  adsConfig?: unknown
): Promise<string> {
  const ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  const ctx = await resolveCreateAdCompanyContext(companyId);

  const parsed = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: buildStructurizerSystemPrompt(ctx) },
      { role: 'user', content: buildStructurizerUserPrompt(reportData, adsConfig) },
    ],
    { model: 'gpt-4o-mini', jsonMode: true }
  );

  return JSON.stringify(parsed);
}

export async function generateImageConcepts(
  companyId: string,
  tokens: CreateAdTokens,
  imageItems: AdItemInput[],
  reportData: ReportData,
  structurizerOutput?: string
): Promise<ImageAdConcept[]> {
  const ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  const ctx = await resolveCreateAdCompanyContext(companyId);

  const parsed = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: buildImageAdConceptsSystemPrompt(ctx) },
      {
        role: 'user',
        content: buildImageAdConceptsUserPrompt(imageItems, reportData, structurizerOutput),
      },
    ],
    { model: 'gpt-4o-mini', jsonMode: true }
  );

  const imageAds = (parsed.image_ads as ImageAdConcept[]) || [];
  return imageAds;
}
