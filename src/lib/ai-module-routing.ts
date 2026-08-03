/** Shared AI provider + per-module routing (used by settings UI and server runtime). */

/** Order matches client dashboard sidebar: Meta Ads → Social → Cold Email → Newsletter → Blog. */
export const AI_MODULE_IDS = ['metaAds', 'social', 'outreach', 'newsletter', 'blog'] as const;
export type AiModuleId = (typeof AI_MODULE_IDS)[number];

export const AI_MODULE_LABELS: Record<AiModuleId, string> = {
  metaAds: 'Meta Ads',
  social: 'Social Channels',
  newsletter: 'Newsletter',
  outreach: 'Cold Email',
  blog: 'Blog',
};

export const AI_MODULE_DESCRIPTIONS: Record<AiModuleId, string> = {
  metaAds: 'Competitor analysis, ad copy, variants, campaign ideas',
  social: 'Image/video captions and social copy',
  newsletter: 'Newsletter content and HTML templates',
  outreach: 'Cold email generation',
  blog: 'Blog drafts, SEO content, and automation',
};

export const AI_GATEWAY_PROVIDER_IDS = ['openrouter', 'vercelAiGateway'] as const;
export type AiGatewayProviderId = (typeof AI_GATEWAY_PROVIDER_IDS)[number];

export const AI_DIRECT_PROVIDER_IDS = ['googleGemini', 'openai'] as const;
export type AiDirectProviderId = (typeof AI_DIRECT_PROVIDER_IDS)[number];

/** Row order in the settings table: direct providers first, then gateways. */
export const AI_PROVIDER_IDS = [
  ...AI_DIRECT_PROVIDER_IDS,
  ...AI_GATEWAY_PROVIDER_IDS,
] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  googleGemini: 'Gemini',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  vercelAiGateway: 'Vercel AI Gateway',
};

/** Default vendor when none is stored (gateway catalogs are loaded dynamically). */
export const FALLBACK_GATEWAY_VENDOR = 'openai';

/** OpenRouter chat completions (OpenAI-compatible). */
export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/** Vercel AI Gateway OpenAI-compatible endpoint. */
export const VERCEL_AI_GATEWAY_DEFAULT_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** Gemini exposes an OpenAI-compatible surface, so every provider uses one client shape. */
export const GEMINI_OPENAI_COMPAT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

export const AI_PROVIDER_DEFAULT_BASE_URLS: Record<AiProviderId, string> = {
  googleGemini: GEMINI_OPENAI_COMPAT_BASE_URL,
  openai: OPENAI_DEFAULT_BASE_URL,
  openrouter: OPENROUTER_DEFAULT_BASE_URL,
  vercelAiGateway: VERCEL_AI_GATEWAY_DEFAULT_BASE_URL,
};

/** Used when parsing saved routes before a live catalog is available. */
export const FALLBACK_GATEWAY_MODELS: Record<AiGatewayProviderId, string> = {
  openrouter: 'openai/gpt-4o-mini',
  vercelAiGateway: 'openai/gpt-4o-mini',
};

export const AI_DIRECT_MODELS: Record<AiDirectProviderId, string[]> = {
  googleGemini: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
};

export const AI_GATEWAY_KEY_FIELDS = [
  {
    key: 'openrouter' as const,
    label: 'OpenRouter',
    placeholder: 'sk-or-v1-…',
    hint: 'OpenAI-compatible chat completions at openrouter.ai/api/v1.',
  },
  {
    key: 'vercelAiGateway' as const,
    label: 'Vercel AI Gateway',
    placeholder: 'vck_… or gateway bearer token',
    hint: 'Separate gateway hop; model slugs come from your Vercel AI Gateway dashboard.',
  },
];

export type AiGatewayKeyField = (typeof AI_GATEWAY_KEY_FIELDS)[number]['key'];

export type AiGatewayConnectionSettings = {
  openrouterBaseUrl: string;
  vercelGatewayBaseUrl: string;
};

export function defaultGatewayConnectionSettings(): AiGatewayConnectionSettings {
  return {
    openrouterBaseUrl: OPENROUTER_DEFAULT_BASE_URL,
    vercelGatewayBaseUrl: VERCEL_AI_GATEWAY_DEFAULT_BASE_URL,
  };
}

export type AiGatewayRouteOption = { vendor: string; model: string };
export type AiDirectRouteOption = { model: string };

/**
 * Every provider keeps its own vendor/model choice so switching the selected
 * checkbox never discards what was configured on the other rows.
 */
export type AiModuleRoute = {
  selected: AiProviderId;
  googleGemini: AiDirectRouteOption;
  openai: AiDirectRouteOption;
  openrouter: AiGatewayRouteOption;
  vercelAiGateway: AiGatewayRouteOption;
};

export type AiModuleRoutingMap = Record<AiModuleId, AiModuleRoute>;

export function defaultGatewayModel(
  provider: AiGatewayProviderId,
  vendor: string,
  modelsByVendor?: Record<string, string[]>
): string {
  const models = modelsByVendor?.[vendor];
  if (models?.length) return models[0];
  return FALLBACK_GATEWAY_MODELS[provider];
}

export function defaultAiModuleRoute(): AiModuleRoute {
  return {
    selected: 'openai',
    googleGemini: { model: AI_DIRECT_MODELS.googleGemini[0] },
    openai: { model: AI_DIRECT_MODELS.openai[0] },
    openrouter: { vendor: FALLBACK_GATEWAY_VENDOR, model: FALLBACK_GATEWAY_MODELS.openrouter },
    vercelAiGateway: {
      vendor: FALLBACK_GATEWAY_VENDOR,
      model: FALLBACK_GATEWAY_MODELS.vercelAiGateway,
    },
  };
}

export function defaultAiModuleRouting(): AiModuleRoutingMap {
  return Object.fromEntries(
    AI_MODULE_IDS.map((id) => [id, defaultAiModuleRoute()])
  ) as AiModuleRoutingMap;
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return AI_PROVIDER_IDS.includes(value as AiProviderId);
}

export function isGatewayProvider(provider: AiProviderId): provider is AiGatewayProviderId {
  return provider === 'openrouter' || provider === 'vercelAiGateway';
}

/** Model configured for the provider currently selected on a module. */
export function selectedRouteModel(route: AiModuleRoute): string {
  return route[route.selected].model;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseDirectOption(raw: unknown, provider: AiDirectProviderId): AiDirectRouteOption {
  const entry = (raw ?? {}) as { model?: unknown };
  return { model: parseString(entry.model, AI_DIRECT_MODELS[provider][0]) };
}

function parseGatewayOption(raw: unknown, provider: AiGatewayProviderId): AiGatewayRouteOption {
  const entry = (raw ?? {}) as { vendor?: unknown; model?: unknown };
  const vendor =
    typeof entry.vendor === 'string' && entry.vendor.trim()
      ? entry.vendor.trim()
      : FALLBACK_GATEWAY_VENDOR;
  return { vendor, model: parseString(entry.model, FALLBACK_GATEWAY_MODELS[provider]) };
}

export function parseAiModuleRoute(raw: unknown): AiModuleRoute {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultAiModuleRoute();
  const entry = raw as Record<string, unknown>;
  return {
    selected: isAiProviderId(entry.selected) ? entry.selected : 'openai',
    googleGemini: parseDirectOption(entry.googleGemini, 'googleGemini'),
    openai: parseDirectOption(entry.openai, 'openai'),
    openrouter: parseGatewayOption(entry.openrouter, 'openrouter'),
    vercelAiGateway: parseGatewayOption(entry.vercelAiGateway, 'vercelAiGateway'),
  };
}

export function parseAiModuleRouting(raw: unknown): AiModuleRoutingMap {
  const base = defaultAiModuleRouting();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  for (const moduleId of AI_MODULE_IDS) {
    const entry = (raw as Record<string, unknown>)[moduleId];
    if (entry) base[moduleId] = parseAiModuleRoute(entry);
  }
  return base;
}

export function parseGatewayConnection(raw: unknown): AiGatewayConnectionSettings {
  const defaults = defaultGatewayConnectionSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const entry = raw as Record<string, unknown>;
  return {
    openrouterBaseUrl: parseString(entry.openrouterBaseUrl, defaults.openrouterBaseUrl),
    vercelGatewayBaseUrl: parseString(entry.vercelGatewayBaseUrl, defaults.vercelGatewayBaseUrl),
  };
}

/** Maps provider choice to its API Keys field key (direct providers only). */
export function directProviderSecretKey(provider: AiProviderId): AiDirectProviderId | null {
  if (provider === 'openai' || provider === 'googleGemini') return provider;
  return null;
}

export function gatewayProviderSecretKey(provider: AiProviderId): AiGatewayKeyField | null {
  return isGatewayProvider(provider) ? provider : null;
}
