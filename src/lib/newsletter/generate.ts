import { chatCompletionText } from '@/lib/social-studio/openai';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import { resolveNewsletterContext } from './company-context';
import {
  buildContentSystemPrompt,
  buildContentUserPrompt,
  buildRegenerateUserPrompt,
} from './prompts';
import { parseNewsletterSections } from './parse-sections';
import { getNewsletterTokens } from './tokens';
import type { NewsletterData, NewsletterTokens } from './types';

export async function generateNewsletterContent(
  companyId: string,
  tokens: NewsletterTokens,
  service: string,
  topic: string
): Promise<NewsletterData> {
  const ai = await resolveModuleAi(companyId, 'newsletter', tokens.openai);
  const ctx = await resolveNewsletterContext(companyId);

  const raw = await chatCompletionText(
    ai,
    [
      { role: 'system', content: buildContentSystemPrompt(ctx) },
      { role: 'user', content: buildContentUserPrompt(ctx, service, topic) },
    ],
    { model: 'gpt-4o-mini', timeoutMs: 600_000 }
  );

  return parseNewsletterSections(raw);
}

export async function regenerateNewsletterContent(
  companyId: string,
  tokens: NewsletterTokens,
  service: string,
  topic: string,
  retryPrompt: string,
  previousContent: NewsletterData
): Promise<NewsletterData> {
  const ai = await resolveModuleAi(companyId, 'newsletter', tokens.openai);
  const ctx = await resolveNewsletterContext(companyId);

  const raw = await chatCompletionText(
    ai,
    [
      { role: 'system', content: buildContentSystemPrompt(ctx) },
      {
        role: 'user',
        content: buildRegenerateUserPrompt(ctx, service, topic, retryPrompt, previousContent),
      },
    ],
    { model: 'gpt-4o-mini', timeoutMs: 600_000 }
  );

  return parseNewsletterSections(raw);
}

export async function runGenerate(companyId: string, service: string, topic: string) {
  const tokens = await getNewsletterTokens(companyId);
  const data = await generateNewsletterContent(companyId, tokens, service, topic);
  return { ...data, output: undefined };
}

export async function runRegenerate(
  companyId: string,
  service: string,
  topic: string,
  retryPrompt: string,
  previousContent: NewsletterData
) {
  const tokens = await getNewsletterTokens(companyId);
  const data = await regenerateNewsletterContent(
    companyId,
    tokens,
    service,
    topic,
    retryPrompt,
    previousContent
  );
  return { ...data, output: undefined };
}
