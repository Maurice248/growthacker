import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { formatDataForSeoCredential } from '@/lib/dataforseo-credentials';
import { getCompanyIntegrations, getWordPressConfigFromIntegrations } from '@/lib/company-integrations';
import type { BlogTokens } from './types';
import type { WordPressConfig } from '@/lib/wordpress';

function resolveDataForSeoCredential(secrets: Awaited<ReturnType<typeof getCompanyApiTokenSecrets>>) {
  const stored = secrets.dataforseo?.trim();
  if (stored) return stored;

  const combined = process.env.DATAFORSEO_CREDENTIAL?.trim();
  if (combined) return combined;

  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (login && password) return formatDataForSeoCredential(login, password);

  return null;
}

export async function getBlogTokens(companyId: string): Promise<BlogTokens> {
  const secrets = await getCompanyApiTokenSecrets(companyId);
  return {
    openai: secrets.openai?.trim() || null,
    kie: secrets.kie?.trim() || null,
    dataforseo: resolveDataForSeoCredential(secrets),
  };
}

export function requireToken(
  tokens: BlogTokens,
  key: keyof BlogTokens,
  label: string
): string {
  const value = tokens[key];
  if (!value) {
    throw new Error(`${label} is not configured. Add it in API Keys.`);
  }
  return value;
}

export async function getBlogWordPressConfig(companyId: string): Promise<WordPressConfig | null> {
  const creds = await getCompanyIntegrations(companyId);
  return getWordPressConfigFromIntegrations(creds);
}
