import { chatCompletionJson } from '@/lib/create-ad/openai';
import { resolveCreateAdCompanyContext } from '@/lib/create-ad/company-context';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import type { CreateAdTokens } from '@/lib/create-ad/types';

export type AdCopyFields = {
  name: string;
  primary_text: string;
  description: string;
};

export type VariantCopyContext = {
  id: string;
  label: string;
  angle?: string;
  idea?: string;
};

export async function generateVariantAdCopy(
  companyId: string,
  tokens: CreateAdTokens,
  base: AdCopyFields & { headline?: string },
  variants: VariantCopyContext[]
): Promise<Record<string, AdCopyFields>> {
  if (!variants.length) return {};

  const ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  const ctx = await resolveCreateAdCompanyContext(companyId);

  const parsed = await chatCompletionJson(
    ai,
    [
      {
        role: 'system',
        content: `You are a Meta ads copywriter for ${ctx.companyName}.
Generate unique ad copy for each ad variant in a split-test set. All variants promote the same offer but must feel distinct.
Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: `Base variant copy (use as reference — do not repeat verbatim):
${JSON.stringify({
  ad_name: base.name,
  primary_text: base.primary_text,
  ad_description: base.description,
  headline: base.headline || '',
})}

Brand context:
${JSON.stringify({
  company: ctx.companyName,
  products_services: ctx.brand.productsAndServices,
  value_proposition: ctx.brand.valueProposition,
  brand_voice: ctx.brand.brandVoice,
})}

Generate copy for these ${variants.length} additional variant(s):
${JSON.stringify(
  variants.map((v, i) => ({
    variant_id: v.id,
    label: v.label,
    creative_angle: v.angle || `angle_${i + 1}`,
    creative_idea: v.idea || '',
  }))
)}

Rules:
- Each variant needs a unique ad_name (keep a similar naming pattern to the base, e.g. suffix _v2, _v3 or descriptive slug)
- primary_text: 1-3 sentences, Meta-friendly, distinct hook per variant
- ad_description: short supporting line (can be empty string if not needed)
- Stay on-brand and on-offer

JSON shape:
{
  "variants": [
    {
      "variant_id": "...",
      "ad_name": "...",
      "primary_text": "...",
      "ad_description": "..."
    }
  ]
}`,
      },
    ],
    { model: 'gpt-4o-mini', jsonMode: true }
  );

  const rows = Array.isArray(parsed.variants) ? parsed.variants : [];
  const result: Record<string, AdCopyFields> = {};

  for (const row of rows) {
    const id = String(row.variant_id || '');
    if (!id) continue;
    result[id] = {
      name: String(row.ad_name || '').trim(),
      primary_text: String(row.primary_text || '').trim(),
      description: String(row.ad_description || '').trim(),
    };
  }

  return result;
}
