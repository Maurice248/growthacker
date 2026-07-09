import { prisma } from '@/lib/prisma';
import { getRequestCompanyId } from '@/lib/auth';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/integration-crypto';

export interface IntegrationCredentials {
  metaAccessToken: string | null;
  metaAdAccountId: string | null;
  metaPageId: string | null;
  elevenLabsApiKey: string | null;
  wordpressSiteUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPassword: string | null;
}

export interface IntegrationSettingsView {
  metaAccessToken: { set: boolean; masked: string };
  metaAdAccountId: string;
  metaPageId: string;
  elevenLabsApiKey: { set: boolean; masked: string };
  wordpressSiteUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: { set: boolean; masked: string };
}

const EMPTY_CREDENTIALS: IntegrationCredentials = {
  metaAccessToken: null,
  metaAdAccountId: null,
  metaPageId: null,
  elevenLabsApiKey: null,
  wordpressSiteUrl: null,
  wordpressUsername: null,
  wordpressAppPassword: null,
};

type IntegrationRow = {
  metaAccessTokenEnc: string | null;
  metaAdAccountId: string | null;
  metaPageId: string | null;
  elevenLabsApiKeyEnc: string | null;
  wordpressSiteUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPasswordEnc: string | null;
};

function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

export function rowToCredentials(row: IntegrationRow | null): IntegrationCredentials {
  if (!row) return { ...EMPTY_CREDENTIALS };
  return {
    metaAccessToken: decryptField(row.metaAccessTokenEnc),
    metaAdAccountId: row.metaAdAccountId,
    metaPageId: row.metaPageId,
    elevenLabsApiKey: decryptField(row.elevenLabsApiKeyEnc),
    wordpressSiteUrl: row.wordpressSiteUrl,
    wordpressUsername: row.wordpressUsername,
    wordpressAppPassword: decryptField(row.wordpressAppPasswordEnc),
  };
}

export function isIntegrationsConfigured(creds: IntegrationCredentials): boolean {
  return Boolean(
    creds.metaAccessToken ||
      creds.metaAdAccountId ||
      creds.metaPageId ||
      creds.elevenLabsApiKey ||
      creds.wordpressSiteUrl ||
      creds.wordpressUsername ||
      creds.wordpressAppPassword
  );
}

export async function getCompanyIntegrations(companyId: string): Promise<IntegrationCredentials> {
  const row = await prisma.companyIntegration.findUnique({ where: { companyId } });
  return rowToCredentials(row);
}

export async function getRequestCompanyIntegrations(): Promise<IntegrationCredentials> {
  const companyId = await getRequestCompanyId();
  if (!companyId) return { ...EMPTY_CREDENTIALS };
  return getCompanyIntegrations(companyId);
}

export function toSettingsView(creds: IntegrationCredentials): IntegrationSettingsView {
  return {
    metaAccessToken: {
      set: Boolean(creds.metaAccessToken),
      masked: creds.metaAccessToken ? maskSecret(creds.metaAccessToken) : '',
    },
    metaAdAccountId: creds.metaAdAccountId || '',
    metaPageId: creds.metaPageId || '',
    elevenLabsApiKey: {
      set: Boolean(creds.elevenLabsApiKey),
      masked: creds.elevenLabsApiKey ? maskSecret(creds.elevenLabsApiKey) : '',
    },
    wordpressSiteUrl: creds.wordpressSiteUrl || '',
    wordpressUsername: creds.wordpressUsername || '',
    wordpressAppPassword: {
      set: Boolean(creds.wordpressAppPassword),
      masked: creds.wordpressAppPassword ? maskSecret(creds.wordpressAppPassword, 2) : '',
    },
  };
}

export interface IntegrationUpdateInput {
  metaAccessToken?: string;
  metaAdAccountId?: string;
  metaPageId?: string;
  elevenLabsApiKey?: string;
  wordpressSiteUrl?: string;
  wordpressUsername?: string;
  wordpressAppPassword?: string;
}

export async function upsertCompanyIntegrations(
  companyId: string,
  input: IntegrationUpdateInput
): Promise<IntegrationSettingsView> {
  const existing = await prisma.companyIntegration.findUnique({ where: { companyId } });

  const metaAccessToken =
    input.metaAccessToken?.trim()
      ? encryptSecret(input.metaAccessToken.trim())
      : existing?.metaAccessTokenEnc ?? null;

  const elevenLabsApiKey =
    input.elevenLabsApiKey?.trim()
      ? encryptSecret(input.elevenLabsApiKey.trim())
      : existing?.elevenLabsApiKeyEnc ?? null;

  const wordpressAppPassword =
    input.wordpressAppPassword?.trim()
      ? encryptSecret(input.wordpressAppPassword.replace(/\s/g, ''))
      : existing?.wordpressAppPasswordEnc ?? null;

  const data = {
    metaAccessTokenEnc: metaAccessToken,
    metaAdAccountId:
      input.metaAdAccountId !== undefined
        ? input.metaAdAccountId.trim() || null
        : existing?.metaAdAccountId ?? null,
    metaPageId:
      input.metaPageId !== undefined ? input.metaPageId.trim() || null : existing?.metaPageId ?? null,
    elevenLabsApiKeyEnc: elevenLabsApiKey,
    wordpressSiteUrl:
      input.wordpressSiteUrl !== undefined
        ? input.wordpressSiteUrl.trim().replace(/\/$/, '') || null
        : existing?.wordpressSiteUrl ?? null,
    wordpressUsername:
      input.wordpressUsername !== undefined
        ? input.wordpressUsername.trim() || null
        : existing?.wordpressUsername ?? null,
    wordpressAppPasswordEnc: wordpressAppPassword,
  };

  await prisma.companyIntegration.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });

  const resolved = await getCompanyIntegrations(companyId);
  return toSettingsView(resolved);
}

export async function seedIntegrationsFromEnv(companyId: string): Promise<void> {
  const existing = await prisma.companyIntegration.findUnique({ where: { companyId } });
  if (existing) return;

  const metaAccessToken = process.env.META_ACCESS_TOKEN?.trim();
  const metaAdAccountId = process.env.META_AD_ACCOUNT_ID?.trim();
  const metaPageId = process.env.META_PAGE_ID?.trim();
  const elevenLabsApiKey =
    process.env.ELEVENLABS_API_KEY?.trim() || process.env.ELEVEN_LABS_API_KEY?.trim();
  const wordpressSiteUrl = process.env.WORDPRESS_SITE_URL?.trim();
  const wordpressUsername = process.env.WORDPRESS_USERNAME?.trim();
  const wordpressAppPassword = process.env.WORDPRESS_APP_PASSWORD?.replace(/\s/g, '');

  const hasAny =
    metaAccessToken ||
    metaAdAccountId ||
    metaPageId ||
    elevenLabsApiKey ||
    wordpressSiteUrl;

  if (!hasAny) return;

  await upsertCompanyIntegrations(companyId, {
    metaAccessToken: metaAccessToken || undefined,
    metaAdAccountId: metaAdAccountId || undefined,
    metaPageId: metaPageId || undefined,
    elevenLabsApiKey: elevenLabsApiKey || undefined,
    wordpressSiteUrl: wordpressSiteUrl || undefined,
    wordpressUsername: wordpressUsername || undefined,
    wordpressAppPassword: wordpressAppPassword || undefined,
  });
}

export function getWordPressConfigFromIntegrations(creds: IntegrationCredentials) {
  const siteUrl = creds.wordpressSiteUrl?.trim().replace(/\/$/, '');
  const username = creds.wordpressUsername?.trim();
  const appPassword = creds.wordpressAppPassword?.replace(/\s/g, '');
  if (!siteUrl || !username || !appPassword) return null;
  return { siteUrl, username, appPassword };
}

export function isWordPressConfiguredFromIntegrations(creds: IntegrationCredentials): boolean {
  return getWordPressConfigFromIntegrations(creds) !== null;
}
