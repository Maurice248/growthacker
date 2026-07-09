import { chatCompletionJson } from '../openai';
import {
  buildVoiceoverScriptSystemPrompt,
  buildVoiceoverScriptUserPrompt,
} from '../prompts';
import { resolveCreateAdCompanyContext } from '../company-context';
import { requireToken } from '../tokens';
import type { AdItemInput, CreateAdTokens } from '../types';

export async function generateVoiceoverScript(
  companyId: string,
  tokens: CreateAdTokens,
  item: AdItemInput
): Promise<{ id: number; script: string }> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveCreateAdCompanyContext(companyId);

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: buildVoiceoverScriptSystemPrompt(ctx) },
      { role: 'user', content: buildVoiceoverScriptUserPrompt(item) },
    ],
    { model: 'gpt-4o-mini', jsonMode: true, timeoutMs: 120_000 }
  );

  return {
    id: Number(parsed.id ?? item.id),
    script: String(parsed.script || ''),
  };
}
