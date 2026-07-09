import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import type { ColdEmailTokens } from './types';

export async function getColdEmailTokens(companyId: string): Promise<ColdEmailTokens> {
  const secrets = await getCompanyApiTokenSecrets(companyId);
  return {
    openai: secrets.openai?.trim() || null,
    apify: secrets.apify?.trim() || null,
    millionVerifier: secrets.millionVerifier?.trim() || null,
    instantly: secrets.instantlyAi?.trim() || null,
  };
}

export function requireToken(
  tokens: ColdEmailTokens,
  key: keyof ColdEmailTokens,
  label: string
): string {
  const value = tokens[key];
  if (!value) {
    throw new Error(`${label} is not configured. Add it in API key management.`);
  }
  return value;
}
