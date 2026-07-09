import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { getCompanyIntegrations } from '@/lib/company-integrations';
import type { CreateAdTokens } from './types';

export async function getCreateAdTokens(companyId: string): Promise<CreateAdTokens> {
  const [secrets, integrations] = await Promise.all([
    getCompanyApiTokenSecrets(companyId),
    getCompanyIntegrations(companyId),
  ]);

  return {
    openai: secrets.openai?.trim() || null,
    kie: secrets.kie?.trim() || null,
    assemblyai: secrets.assemblyai?.trim() || null,
    uploadPost: secrets.uploadPost?.trim() || null,
    elevenLabs: secrets.elevenLabs?.trim() || integrations.elevenLabsApiKey?.trim() || null,
  };
}

export function requireToken(
  tokens: CreateAdTokens,
  key: keyof CreateAdTokens,
  label: string
): string {
  const value = tokens[key];
  if (!value) {
    throw new Error(`${label} is not configured. Add it in Integrations → API Tokens.`);
  }
  return value;
}
