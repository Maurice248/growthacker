import type { IntegrationCredentials } from '@/lib/company-integrations';
import { credentialsToN8nConfig, getN8nWebhook } from '@/lib/company-integrations';

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

function n8nWebhooksConfigured(creds: IntegrationCredentials, keys: string[]): boolean {
  const config = credentialsToN8nConfig(creds);
  return keys.every((key) => Boolean(getN8nWebhook(config, key)));
}

function outreachConfigured(creds: IntegrationCredentials): boolean {
  return n8nWebhooksConfigured(creds, ['N8N_CAMPAIGN_WEBHOOK_URL', 'N8N_SCRAPER_WEBHOOK_URL']);
}

function newsletterConfigured(creds: IntegrationCredentials): boolean {
  return n8nWebhooksConfigured(creds, ['NEXT_PUBLIC_N8N_GENERATE_WEBHOOK_URL']);
}

function socialConfigured(creds: IntegrationCredentials): boolean {
  return n8nWebhooksConfigured(creds, ['NEXT_PUBLIC_N8N_SOCIAL_POST_URL']);
}

function blogConfigured(creds: IntegrationCredentials): boolean {
  return Boolean(
    creds.wordpressSiteUrl &&
      creds.wordpressUsername &&
      creds.wordpressAppPassword &&
      n8nWebhooksConfigured(creds, ['N8N_BLOG_AUTOMATION_WEBHOOK_URL'])
  );
}

export function getModuleStatuses(creds: IntegrationCredentials): ModuleStatus[] {
  const modules: Array<{ id: ModuleId; label: string; keys: string[]; ok: boolean }> = [
    {
      id: 'meta',
      label: 'Meta Ads',
      keys: ['Meta access token', 'Meta ad account ID'],
      ok: metaConfigured(creds),
    },
    {
      id: 'social',
      label: 'Social Dash',
      keys: ['NEXT_PUBLIC_N8N_SOCIAL_POST_URL'],
      ok: socialConfigured(creds),
    },
    {
      id: 'newsletter',
      label: 'Newsletter',
      keys: ['NEXT_PUBLIC_N8N_GENERATE_WEBHOOK_URL'],
      ok: newsletterConfigured(creds),
    },
    {
      id: 'outreach',
      label: 'Cold Email',
      keys: ['N8N_CAMPAIGN_WEBHOOK_URL', 'N8N_SCRAPER_WEBHOOK_URL'],
      ok: outreachConfigured(creds),
    },
    {
      id: 'blog',
      label: 'Blog',
      keys: ['WordPress credentials', 'N8N_BLOG_AUTOMATION_WEBHOOK_URL'],
      ok: blogConfigured(creds),
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

export function isAnyModuleConfigured(creds: IntegrationCredentials): boolean {
  return getModuleStatuses(creds).some((m) => m.configured);
}

export function isModuleConfigured(creds: IntegrationCredentials, moduleId: ModuleId): boolean {
  return getModuleStatuses(creds).find((m) => m.id === moduleId)?.configured ?? false;
}

export const MODULE_TAB_IDS: Record<ModuleId, Set<string>> = {
  meta: new Set([
    'analysis',
    'overview',
    'create',
    'approval',
    'campaigns',
    'live_campaigns',
    'ad_performance',
    'reports',
  ]),
  social: new Set(['social-dash']),
  newsletter: new Set([
    'newsletter-dashboard',
    'newsletter-generate',
    'newsletter-campaign',
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
  ]),
  blog: new Set(['blog-post', 'blog-automation']),
};

export function moduleForTab(tabId: string): ModuleId | null {
  for (const [moduleId, ids] of Object.entries(MODULE_TAB_IDS) as [ModuleId, Set<string>][]) {
    if (ids.has(tabId)) return moduleId;
  }
  return null;
}
