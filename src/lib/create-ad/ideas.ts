import { chatCompletionJson } from './openai';
import {
  buildIdeaGenerationSystemPrompt,
  buildIdeaGenerationUserPrompt,
} from './prompts';
import { resolveCreateAdCompanyContext } from './company-context';
import { requireToken } from './tokens';
import type { AdItemInput, CreateAdTokens, IdeaResult } from './types';

export async function generateIdeas(
  companyId: string,
  tokens: CreateAdTokens,
  item: AdItemInput,
  brandConfig?: unknown
): Promise<{ ideas: IdeaResult[] }> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveCreateAdCompanyContext(companyId, brandConfig);

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: buildIdeaGenerationSystemPrompt(ctx) },
      { role: 'user', content: buildIdeaGenerationUserPrompt(item) },
    ],
    { model: 'gpt-4o-mini', jsonMode: true }
  );

  const ideas = (parsed.ideas as IdeaResult[]) || [];
  return { ideas };
}
