import { chatCompletionJson } from '../openai';
import {
  buildVoiceoverScriptSystemPrompt,
  buildVoiceoverScriptUserPrompt,
} from '../prompts';
import { resolveCreateAdCompanyContext } from '../company-context';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import type { AdItemInput, CreateAdTokens } from '../types';

export async function generateVoiceoverScript(
  companyId: string,
  tokens: CreateAdTokens,
  item: AdItemInput
): Promise<{ id: number; script: string }> {
  const ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  const ctx = await resolveCreateAdCompanyContext(companyId);

  const parsed = await chatCompletionJson(
    ai,
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
