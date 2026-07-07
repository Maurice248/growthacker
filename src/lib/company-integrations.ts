import { prisma } from '@/lib/prisma';
import { getRequestCompanyId } from '@/lib/auth';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/integration-crypto';
import {
  DEFAULT_BLOG_WORKFLOW_ID,
  DEFAULT_BLOG_WORKFLOW_NAME,
  type N8nWebhooksMap,
  parseWebhooksJson,
  webhooksFromEnv,
  type ResolvedN8nConfig,
} from '@/lib/n8n-config';

export interface IntegrationCredentials {
  metaAccessToken: string | null;
  metaAdAccountId: string | null;
  metaPageId: string | null;
  elevenLabsApiKey: string | null;
  wordpressSiteUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPassword: string | null;
  n8nApiKey: string | null;
  n8nApiBaseUrl: string | null;
  n8nBlogWorkflowId: string | null;
  n8nBlogWorkflowName: string | null;
  n8nWebhooks: N8nWebhooksMap;
}

export interface IntegrationSettingsView {
  metaAccessToken: { set: boolean; masked: string };
  metaAdAccountId: string;
  metaPageId: string;
  elevenLabsApiKey: { set: boolean; masked: string };
  wordpressSiteUrl: string;
  wordpressUsername: string;
  wordpressAppPassword: { set: boolean; masked: string };
  n8nApiKey: { set: boolean; masked: string };
  n8nApiBaseUrl: string;
  n8nBlogWorkflowId: string;
  n8nBlogWorkflowName: string;
  n8nWebhooks: N8nWebhooksMap;
}

const EMPTY_CREDENTIALS: IntegrationCredentials = {
  metaAccessToken: null,
  metaAdAccountId: null,
  metaPageId: null,
  elevenLabsApiKey: null,
  wordpressSiteUrl: null,
  wordpressUsername: null,
  wordpressAppPassword: null,
  n8nApiKey: null,
  n8nApiBaseUrl: null,
  n8nBlogWorkflowId: null,
  n8nBlogWorkflowName: null,
  n8nWebhooks: {},
};

type IntegrationRow = {
  metaAccessTokenEnc: string | null;
  metaAdAccountId: string | null;
  metaPageId: string | null;
  elevenLabsApiKeyEnc: string | null;
  wordpressSiteUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPasswordEnc: string | null;
  n8nApiKeyEnc?: string | null;
  n8nApiBaseUrl?: string | null;
  n8nBlogWorkflowId?: string | null;
  n8nBlogWorkflowName?: string | null;
  n8nWebhooksJson?: unknown;
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
    n8nApiKey: decryptField(row.n8nApiKeyEnc ?? null),
    n8nApiBaseUrl: row.n8nApiBaseUrl ?? null,
    n8nBlogWorkflowId: row.n8nBlogWorkflowId ?? null,
    n8nBlogWorkflowName: row.n8nBlogWorkflowName ?? null,
    n8nWebhooks: parseWebhooksJson(row.n8nWebhooksJson),
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
      creds.wordpressAppPassword ||
      creds.n8nApiKey ||
      creds.n8nApiBaseUrl ||
      Object.keys(creds.n8nWebhooks).length > 0
  );
}

export async function getCompanyIntegrations(companyId: string): Promise<IntegrationCredentials> {
  const row = await prisma.companyIntegration.findUnique({ where: { companyId } });
  if (!row) return { ...EMPTY_CREDENTIALS };
  const n8nExtras = await fetchN8nIntegrationExtras(companyId);
  return rowToCredentials({ ...row, ...(n8nExtras ?? {}) });
}

type N8nIntegrationExtras = {
  n8nApiKeyEnc: string | null;
  n8nApiBaseUrl: string | null;
  n8nBlogWorkflowId: string | null;
  n8nBlogWorkflowName: string | null;
  n8nWebhooksJson: unknown;
};

async function fetchN8nIntegrationExtras(companyId: string): Promise<N8nIntegrationExtras | null> {
  const rows = await prisma.$queryRaw<N8nIntegrationExtras[]>`
    SELECT
      "n8nApiKeyEnc",
      "n8nApiBaseUrl",
      "n8nBlogWorkflowId",
      "n8nBlogWorkflowName",
      "n8nWebhooksJson"
    FROM company_integrations
    WHERE "companyId" = ${companyId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function persistN8nIntegrationFields(
  companyId: string,
  fields: {
    n8nApiKeyEnc: string | null;
    n8nApiBaseUrl: string | null;
    n8nBlogWorkflowId: string | null;
    n8nBlogWorkflowName: string | null;
    n8nWebhooksJson: N8nWebhooksMap;
  }
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE company_integrations
    SET
      "n8nApiKeyEnc" = ${fields.n8nApiKeyEnc},
      "n8nApiBaseUrl" = ${fields.n8nApiBaseUrl},
      "n8nBlogWorkflowId" = ${fields.n8nBlogWorkflowId},
      "n8nBlogWorkflowName" = ${fields.n8nBlogWorkflowName},
      "n8nWebhooksJson" = CAST(${JSON.stringify(fields.n8nWebhooksJson)} AS jsonb),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "companyId" = ${companyId}
  `;
}

export async function getRequestCompanyIntegrations(): Promise<IntegrationCredentials> {
  const companyId = await getRequestCompanyId();
  if (!companyId) return { ...EMPTY_CREDENTIALS };
  return getCompanyIntegrations(companyId);
}

export async function getRequestN8nConfig(): Promise<ResolvedN8nConfig> {
  const creds = await getRequestCompanyIntegrations();
  return credentialsToN8nConfig(creds);
}

export function credentialsToN8nConfig(creds: IntegrationCredentials): ResolvedN8nConfig {
  const envWebhooks = webhooksFromEnv();
  return {
    apiKey: creds.n8nApiKey?.trim() || process.env.N8N_API_KEY?.trim() || null,
    apiBaseUrl:
      creds.n8nApiBaseUrl?.replace(/\/$/, '') ||
      process.env.N8N_API_BASE_URL?.replace(/\/$/, '') ||
      '',
    blogWorkflowId: creds.n8nBlogWorkflowId?.trim() || DEFAULT_BLOG_WORKFLOW_ID,
    blogWorkflowName: creds.n8nBlogWorkflowName?.trim() || DEFAULT_BLOG_WORKFLOW_NAME,
    webhooks: { ...envWebhooks, ...creds.n8nWebhooks },
  };
}

export function getN8nWebhook(config: ResolvedN8nConfig, key: string): string | null {
  return config.webhooks[key]?.trim() || null;
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
    n8nApiKey: {
      set: Boolean(creds.n8nApiKey),
      masked: creds.n8nApiKey ? maskSecret(creds.n8nApiKey) : '',
    },
    n8nApiBaseUrl: creds.n8nApiBaseUrl || '',
    n8nBlogWorkflowId: creds.n8nBlogWorkflowId || '',
    n8nBlogWorkflowName: creds.n8nBlogWorkflowName || '',
    n8nWebhooks: creds.n8nWebhooks,
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
  n8nApiKey?: string;
  n8nApiBaseUrl?: string;
  n8nBlogWorkflowId?: string;
  n8nBlogWorkflowName?: string;
  n8nWebhooks?: N8nWebhooksMap;
}

export async function upsertCompanyIntegrations(
  companyId: string,
  input: IntegrationUpdateInput
): Promise<IntegrationSettingsView> {
  const existing = await prisma.companyIntegration.findUnique({ where: { companyId } });
  const n8nExisting = await fetchN8nIntegrationExtras(companyId);

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

  const n8nApiKey =
    input.n8nApiKey?.trim()
      ? encryptSecret(input.n8nApiKey.trim())
      : n8nExisting?.n8nApiKeyEnc ?? null;

  const existingWebhooks = parseWebhooksJson(n8nExisting?.n8nWebhooksJson);
  const n8nWebhooksJson =
    input.n8nWebhooks !== undefined
      ? Object.fromEntries(
          Object.entries(input.n8nWebhooks).filter(([, v]) => typeof v === 'string' && v.trim())
        )
      : existingWebhooks;

  const baseData = {
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

  const n8nData = {
    n8nApiKeyEnc: n8nApiKey,
    n8nApiBaseUrl:
      input.n8nApiBaseUrl !== undefined
        ? input.n8nApiBaseUrl.trim().replace(/\/$/, '') || null
        : n8nExisting?.n8nApiBaseUrl ?? null,
    n8nBlogWorkflowId:
      input.n8nBlogWorkflowId !== undefined
        ? input.n8nBlogWorkflowId.trim() || null
        : n8nExisting?.n8nBlogWorkflowId ?? null,
    n8nBlogWorkflowName:
      input.n8nBlogWorkflowName !== undefined
        ? input.n8nBlogWorkflowName.trim() || null
        : n8nExisting?.n8nBlogWorkflowName ?? null,
    n8nWebhooksJson,
  };

  await prisma.companyIntegration.upsert({
    where: { companyId },
    create: { companyId, ...baseData },
    update: baseData,
  });

  await persistN8nIntegrationFields(companyId, n8nData);

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
  const n8nApiKey = process.env.N8N_API_KEY?.trim();
  const n8nApiBaseUrl = process.env.N8N_API_BASE_URL?.trim();
  const n8nBlogWorkflowId = process.env.N8N_BLOG_WORKFLOW_ID?.trim();
  const n8nBlogWorkflowName = process.env.N8N_BLOG_WORKFLOW_NAME?.trim();
  const n8nWebhooks = webhooksFromEnv();

  const hasAny =
    metaAccessToken ||
    metaAdAccountId ||
    metaPageId ||
    elevenLabsApiKey ||
    wordpressSiteUrl ||
    n8nApiKey ||
    n8nApiBaseUrl ||
    Object.keys(n8nWebhooks).length > 0;

  if (!hasAny) return;

  await upsertCompanyIntegrations(companyId, {
    metaAccessToken: metaAccessToken || undefined,
    metaAdAccountId: metaAdAccountId || undefined,
    metaPageId: metaPageId || undefined,
    elevenLabsApiKey: elevenLabsApiKey || undefined,
    wordpressSiteUrl: wordpressSiteUrl || undefined,
    wordpressUsername: wordpressUsername || undefined,
    wordpressAppPassword: wordpressAppPassword || undefined,
    n8nApiKey: n8nApiKey || undefined,
    n8nApiBaseUrl: n8nApiBaseUrl || undefined,
    n8nBlogWorkflowId: n8nBlogWorkflowId || undefined,
    n8nBlogWorkflowName: n8nBlogWorkflowName || undefined,
    n8nWebhooks,
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
