import { prisma } from '@/lib/prisma';
import { chatCompletionText } from '@/lib/social-studio/openai';
import { resolveNewsletterContext } from './company-context';
import { buildHtmlSystemPrompt, buildHtmlUserPrompt } from './prompts';
import { getNewsletterTokens, requireToken } from './tokens';
import type { NewsletterData } from './types';

function normalizeHtmlPlaceholders(html: string): string {
  let result = html;

  result = result.replace(/Hello there!/gi, 'Hello {{first_name}}!');
  result = result.replace(/Hello\s+[A-Za-z]+!/g, 'Hello {{first_name}}!');
  result = result.replace(/Hello\s*!/g, 'Hello {{first_name}}!');
  result = result.replace(/Hi there!/gi, 'Hello {{first_name}}!');
  result = result.replace(/\[\[subscriber_first_name\]\]/g, '{{first_name}}');
  result = result.replace(/\[\[subscriber_last_name\]\]/g, '{{last_name}}');
  result = result.replace(/\[\[subscriber_email\]\]/g, '{{email}}');
  result = result.replace(/\[\[service_type\]\]/g, '{{service_type}}');
  result = result.replace(/\{\{\{subscriber_first_name\}\}\}/g, '{{first_name}}');
  result = result.replace(/\{\{\{subscriber_last_name\}\}\}/g, '{{last_name}}');
  result = result.replace(/\{\{\{subscriber_email\}\}\}/g, '{{email}}');
  result = result.replace(/\{\{\{service_type\}\}\}/g, '{{service_type}}');
  result = result.replace(
    /unsubscribe\?email=(?!\{)[^"']*/g,
    'unsubscribe?token={{unsubscribe_token}}'
  );

  return result.trim();
}

export async function buildNewsletterHtml(
  companyId: string,
  content: NewsletterData,
  service: string,
  topic: string
): Promise<string> {
  const tokens = await getNewsletterTokens(companyId);
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI');
  const ctx = await resolveNewsletterContext(companyId);

  const raw = await chatCompletionText(
    openaiKey,
    [
      { role: 'system', content: buildHtmlSystemPrompt(ctx) },
      { role: 'user', content: buildHtmlUserPrompt(content, service, topic) },
    ],
    { model: 'gpt-4o-mini', timeoutMs: 600_000 }
  );

  return normalizeHtmlPlaceholders(raw);
}

export async function createNewsletterTemplate(
  companyId: string,
  content: NewsletterData,
  service: string,
  topic: string
) {
  const html = await buildNewsletterHtml(companyId, content, service, topic);

  const template = await prisma.newsletterTemplate.create({
    data: {
      companyId,
      name: 'newsletter',
      service,
      topic,
      subjectLine: content.subjectLine || '',
      preheader: content.preheader || '',
      html,
      structuredJson: content as object,
    },
  });

  return {
    templateId: template.id,
    template,
  };
}
