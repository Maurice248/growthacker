import type { IntegrationCredentials } from '@/lib/company-integrations';
import { rowToCredentials } from '@/lib/company-integrations';
import type { ApiTokenSecretsMap } from '@/lib/api-token-secrets';

export type ModuleId = 'meta' | 'social' | 'newsletter' | 'outreach' | 'blog';

export type ModuleStatus = {
  id: ModuleId;
  label: string;
  configured: boolean;
  requiredKeys: string[];
  missingKeys: string[];
};

function metaConfigured(creds: IntegrationCredentials): boolean {
  return Boolean(creds.metaAccessToken && creds.metaAdAccountId);
}


function outreachConfigured(_creds: IntegrationCredentials, apiSecrets?: ApiTokenSecretsMap): boolean {
  return Boolean(
    apiSecrets?.openai?.trim() &&
      apiSecrets?.instantlyAi?.trim() &&
      apiSecrets?.apify?.trim() &&
      apiSecrets?.millionVerifier?.trim()
  );
}

function newsletterConfigured(creds: IntegrationCredentials, apiSecrets?: ApiTokenSecretsMap): boolean {
  void creds;
  return Boolean(apiSecrets?.openai?.trim() && apiSecrets?.resend?.trim());
}

function socialConfigured(
  creds: IntegrationCredentials,
  apiSecrets?: ApiTokenSecretsMap
): boolean {
  return Boolean(apiSecrets?.elevenLabs?.trim() || creds.elevenLabsApiKey);
}

function blogConfigured(creds: IntegrationCredentials, apiSecrets?: ApiTokenSecretsMap): boolean {
  const dataforseo =
    apiSecrets?.dataforseo?.trim() || process.env.DATAFORSEO_CREDENTIAL?.trim();
  return Boolean(
    creds.wordpressSiteUrl &&
      creds.wordpressUsername &&
      creds.wordpressAppPassword &&
      apiSecrets?.openai?.trim() &&
      apiSecrets?.kie?.trim() &&
      dataforseo
  );
}

export function getModuleStatuses(
  creds: IntegrationCredentials,
  apiSecrets?: ApiTokenSecretsMap
): ModuleStatus[] {
  const modules: Array<{ id: ModuleId; label: string; keys: string[]; ok: boolean }> = [
    {
      id: 'meta',
      label: 'Meta Ads',
      keys: ['Meta access token', 'Meta ad account ID'],
      ok: metaConfigured(creds),
    },
    {
      id: 'social',
      label: 'Social Channels',
      keys: ['ElevenLabs API key', 'OpenAI/KIE/Upload Post in API key management', 'Social settings in Overview'],
      ok: socialConfigured(creds, apiSecrets),
    },
    {
      id: 'newsletter',
      label: 'Newsletter',
      keys: ['OpenAI API key', 'Resend API key'],
      ok: newsletterConfigured(creds, apiSecrets),
    },
    {
      id: 'outreach',
      label: 'Cold Email',
      keys: ['OpenAI API key', 'Instantly.ai API key', 'Apify API key', 'Million Verifier API key', 'Instantly campaign ID in Settings'],
      ok: outreachConfigured(creds, apiSecrets),
    },
    {
      id: 'blog',
      label: 'Blog',
      keys: ['WordPress credentials', 'OpenAI API key', 'KIE API key', 'DataForSEO login + API password'],
      ok: blogConfigured(creds, apiSecrets),
    },
  ];

  return modules.map((m) => ({
    id: m.id,
    label: m.label,
    configured: m.ok,
    requiredKeys: m.keys,
    missingKeys: m.ok ? [] : m.keys,
  }));
}

export function isAnyModuleConfigured(
  creds: IntegrationCredentials,
  apiSecrets?: ApiTokenSecretsMap
): boolean {
  return getModuleStatuses(creds, apiSecrets).some((m) => m.configured);
}

export function isModuleConfigured(
  creds: IntegrationCredentials,
  moduleId: ModuleId,
  apiSecrets?: ApiTokenSecretsMap
): boolean {
  return getModuleStatuses(creds, apiSecrets).find((m) => m.id === moduleId)?.configured ?? false;
}

/** All modules marked configured — used for APP_ADMIN client dashboard access. */
export function getUnlockedModuleStatusesForAdmin(): ModuleStatus[] {
  return getModuleStatuses(rowToCredentials(null)).map((m) => ({
    ...m,
    configured: true,
    missingKeys: [],
  }));
}

export const MODULE_TAB_IDS: Record<ModuleId, Set<string>> = {
  meta: new Set([
    'analysis',
    'overview',
    'create',
    'variants',
    'campaigns',
    'live_campaigns',
    'ad_performance',
    'reports',
  ]),
  social: new Set(['social-overview', 'social-creator-studio', 'social-dash']),
  newsletter: new Set([
    'newsletter-dashboard',
    'newsletter-overview',
    'newsletter-generate',
    'newsletter-campaign',
    'newsletter-subscribers',
    'newsletter-history',
    'newsletter-services',
  ]),
  outreach: new Set([
    'outreach-dashboard',
    'outreach-campaigns',
    'outreach-analytics',
    'outreach-scraper',
    'outreach-scraper-history',
    'outreach-cleanup',
    'outreach-settings',
    'cold-dm',
    'cold-call',
    'cold-sms',
  ]),
  blog: new Set(['blog-post', 'blog-automation']),
};

export function moduleForTab(tabId: string): ModuleId | null {
  for (const [moduleId, ids] of Object.entries(MODULE_TAB_IDS) as [ModuleId, Set<string>][]) {
    if (ids.has(tabId)) return moduleId;
  }
  return null;
}
