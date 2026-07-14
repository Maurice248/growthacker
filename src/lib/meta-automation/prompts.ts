import { chatCompletionJson } from '@/lib/create-ad/openai';
import { resolveCreateAdCompanyContext } from '@/lib/create-ad/company-context';
import { requireToken } from '@/lib/create-ad/tokens';
import type { CreateAdTokens } from '@/lib/create-ad/types';
import type { BaseAdConcept, VariantConcept } from './types';

const VARIANT_ANGLES = ['result', 'value', 'brand_difference', 'pain_point', 'social_proof'];

export async function generateVariantConcept(
  companyId: string,
  tokens: CreateAdTokens,
  baseConcept: BaseAdConcept,
  variantIndex: number
): Promise<VariantConcept> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveCreateAdCompanyContext(companyId);
  const angle = VARIANT_ANGLES[variantIndex % VARIANT_ANGLES.length];
  const isVideo = baseConcept.format === 'Video';

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      {
        role: 'system',
        content: `You are a Meta ads creative strategist for ${ctx.companyName}.
Generate ONE fresh ad variant inspired by a proven base ad. Keep the same product/service and audience, but use a different creative angle.
Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: `Base ad concept:
${JSON.stringify({
  format: baseConcept.format,
  story: baseConcept.story || baseConcept.idea,
  metadata: baseConcept.metadata,
  angle_to_use: angle,
})}

Create variant #${variantIndex + 1} with angle "${angle}".
${isVideo ? 'Return a first-person video story in the "idea" field (4-6 short sentences).' : 'Return an image ad with "prompt", "headline", "title", and "cta".'}

JSON shape:
{
  "angle": "${angle}",
  "idea": "...",
  "headline": "...",
  "primary_text": "...",
  "prompt": "...",
  "title": "...",
  "cta": "..."
}`,
      },
    ],
    { model: 'gpt-4o-mini', jsonMode: true, timeoutMs: isVideo ? 300_000 : 180_000 }
  );

  return {
    angle,
    idea: String(parsed.idea || ''),
    headline: parsed.headline ? String(parsed.headline) : undefined,
    primary_text: parsed.primary_text ? String(parsed.primary_text) : undefined,
    prompt: parsed.prompt ? String(parsed.prompt) : undefined,
    title: parsed.title ? String(parsed.title) : undefined,
    cta: parsed.cta ? String(parsed.cta) : undefined,
  };
}
