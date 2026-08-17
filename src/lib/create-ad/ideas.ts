import { chatCompletionJson } from './openai';
import {
  buildIdeaGenerationSystemPrompt,
  buildIdeaGenerationUserPrompt,
} from './prompts';
import { resolveCreateAdCompanyContext } from './company-context';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import type { AdItemInput, CreateAdTokens, IdeaResult } from './types';

const IDEA_TEXT_KEYS = [
  'idea',
  'prompt',
  'image_prompt',
  'imagePrompt',
  'description',
  'concept',
  'text',
  'story',
] as const;

function ideaTextFromUnknown(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  for (const key of IDEA_TEXT_KEYS) {
    const nested = obj[key];
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return '';
}

function normalizeIdeas(parsed: Record<string, unknown>, item: AdItemInput): IdeaResult[] {
  const raw = parsed.ideas ?? parsed.image_ideas ?? parsed.prompts ?? parsed.concepts;
  const list = Array.isArray(raw) ? raw : [];

  return list
    .map((entry, index) => {
      const obj = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      return {
        id: Number(obj.id) || index + 1,
        type: String(obj.type || item.type),
        angle: String(obj.angle || ''),
        idea: ideaTextFromUnknown(entry),
      };
    })
    .filter((row) => row.idea);
}

export async function generateIdeas(
  companyId: string,
  tokens: CreateAdTokens,
  item: AdItemInput,
  brandConfig?: unknown
): Promise<{ ideas: IdeaResult[] }> {
  const ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  const ctx = await resolveCreateAdCompanyContext(companyId, brandConfig);

  const parsed = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: buildIdeaGenerationSystemPrompt(ctx, item.type) },
      { role: 'user', content: buildIdeaGenerationUserPrompt(item) },
    ],
    { model: 'gpt-4o-mini', jsonMode: true }
  );

  const ideas = normalizeIdeas(parsed, item);
  if (!ideas.length) {
    throw new Error('AI returned no usable image/video ideas. Try generating again.');
  }
  return { ideas };
}
