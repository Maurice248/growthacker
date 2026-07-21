import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import type { NewsletterTokens } from './types';

export async function getNewsletterTokens(companyId: string): Promise<NewsletterTokens> {
  const secrets = await getCompanyApiTokenSecrets(companyId);
  return {
    openai: secrets.openai?.trim() || null,
    resend: secrets.resend?.trim() || null,
  };
}

export function requireToken(
  tokens: NewsletterTokens,
  key: keyof NewsletterTokens,
  label: string
): string {
  const value = tokens[key];
  if (!value) {
    throw new Error(`${label} is not configured. Add it in API Keys.`);
  }
  return value;
}
