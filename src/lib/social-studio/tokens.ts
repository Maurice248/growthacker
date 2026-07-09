import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { getCompanyIntegrations } from '@/lib/company-integrations';
import type { SocialStudioTokens } from './types';

export async function getSocialStudioTokens(companyId: string): Promise<SocialStudioTokens> {
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
  tokens: SocialStudioTokens,
  key: keyof SocialStudioTokens,
  label: string
): string {
  const value = tokens[key];
  if (!value) {
    throw new Error(`${label} is not configured. Add it in API key management.`);
  }
  return value;
}
