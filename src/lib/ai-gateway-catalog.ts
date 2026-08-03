import { unstable_cache } from 'next/cache';
import {
  OPENROUTER_DEFAULT_BASE_URL,
  VERCEL_AI_GATEWAY_DEFAULT_BASE_URL,
  type AiGatewayProviderId,
} from '@/lib/ai-module-routing';

export type AiGatewayCatalog = {
  vendors: { id: string; label: string }[];
  modelsByVendor: Record<string, string[]>;
};

export type AiGatewayCatalogMap = Record<AiGatewayProviderId, AiGatewayCatalog>;

type OpenRouterModel = {
  id?: string;
  architecture?: { output_modalities?: string[] };
};

type VercelGatewayModel = {
  id?: string;
  type?: string;
  modalities?: { output?: string[] };
};

function normalizeBaseUrl(baseUrl: string, fallback: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed || fallback;
}

/** Human-readable label from a gateway vendor slug (e.g. meta-llama → Meta Llama). */
export function formatGatewayVendorLabel(vendorId: string): string {
  return vendorId
    .replace(/^~/, '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function vendorFromModelId(modelId: string): string {
  const slash = modelId.indexOf('/');
  if (slash <= 0) return 'other';
  return modelId.slice(0, slash).replace(/^~/, '');
}

function buildCatalog(modelIds: string[]): AiGatewayCatalog {
  const modelsByVendor: Record<string, string[]> = {};
  for (const id of modelIds) {
    const vendor = vendorFromModelId(id);
    if (!modelsByVendor[vendor]) modelsByVendor[vendor] = [];
    modelsByVendor[vendor].push(id);
  }

  for (const vendor of Object.keys(modelsByVendor)) {
    modelsByVendor[vendor].sort((a, b) => a.localeCompare(b));
  }

  const vendors = Object.keys(modelsByVendor)
    .sort((a, b) => formatGatewayVendorLabel(a).localeCompare(formatGatewayVendorLabel(b)))
    .map((id) => ({ id, label: formatGatewayVendorLabel(id) }));

  return { vendors, modelsByVendor };
}

function openRouterChatModelIds(models: OpenRouterModel[]): string[] {
  const ids: string[] = [];
  for (const model of models) {
    const id = model.id?.trim();
    if (!id || !id.includes('/')) continue;
    const outputs = model.architecture?.output_modalities;
    if (outputs && !outputs.includes('text')) continue;
    ids.push(id);
  }
  return ids;
}

function vercelChatModelIds(models: VercelGatewayModel[]): string[] {
  const ids: string[] = [];
  for (const model of models) {
    const id = model.id?.trim();
    if (!id || !id.includes('/')) continue;
    if (model.type && model.type !== 'language') continue;
    const outputs = model.modalities?.output;
    if (outputs && !outputs.includes('text')) continue;
    ids.push(id);
  }
  return ids;
}

async function fetchModelsJson(baseUrl: string, fallback: string): Promise<unknown[]> {
  const url = `${normalizeBaseUrl(baseUrl, fallback)}/models`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Models request failed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  let payload: { data?: unknown[] };
  try {
    payload = JSON.parse(text) as { data?: unknown[] };
  } catch {
    throw new Error('Models endpoint returned invalid JSON');
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchOpenRouterCatalogUncached(baseUrl: string): Promise<AiGatewayCatalog> {
  const data = (await fetchModelsJson(baseUrl, OPENROUTER_DEFAULT_BASE_URL)) as OpenRouterModel[];
  return buildCatalog(openRouterChatModelIds(data));
}

async function fetchVercelGatewayCatalogUncached(baseUrl: string): Promise<AiGatewayCatalog> {
  const data = (await fetchModelsJson(baseUrl, VERCEL_AI_GATEWAY_DEFAULT_BASE_URL)) as VercelGatewayModel[];
  return buildCatalog(vercelChatModelIds(data));
}

function cachedCatalog(
  gateway: AiGatewayProviderId,
  baseUrl: string,
  fetcher: (url: string) => Promise<AiGatewayCatalog>
): Promise<AiGatewayCatalog> {
  const normalized =
    gateway === 'openrouter'
      ? normalizeBaseUrl(baseUrl, OPENROUTER_DEFAULT_BASE_URL)
      : normalizeBaseUrl(baseUrl, VERCEL_AI_GATEWAY_DEFAULT_BASE_URL);

  return unstable_cache(() => fetcher(normalized), ['ai-gateway-catalog', gateway, normalized], {
    revalidate: 3600,
  })();
}

export async function getOpenRouterCatalog(
  baseUrl = OPENROUTER_DEFAULT_BASE_URL
): Promise<AiGatewayCatalog> {
  return cachedCatalog('openrouter', baseUrl, fetchOpenRouterCatalogUncached);
}

export async function getVercelGatewayCatalog(
  baseUrl = VERCEL_AI_GATEWAY_DEFAULT_BASE_URL
): Promise<AiGatewayCatalog> {
  return cachedCatalog('vercelAiGateway', baseUrl, fetchVercelGatewayCatalogUncached);
}

export async function getAiGatewayCatalogs(options?: {
  openrouterBaseUrl?: string;
  vercelGatewayBaseUrl?: string;
}): Promise<AiGatewayCatalogMap> {
  const [openrouter, vercelAiGateway] = await Promise.all([
    getOpenRouterCatalog(options?.openrouterBaseUrl ?? OPENROUTER_DEFAULT_BASE_URL),
    getVercelGatewayCatalog(options?.vercelGatewayBaseUrl ?? VERCEL_AI_GATEWAY_DEFAULT_BASE_URL),
  ]);
  return { openrouter, vercelAiGateway };
}

export function firstModelForVendor(catalog: AiGatewayCatalog | null | undefined, vendor: string): string | null {
  const models = catalog?.modelsByVendor[vendor];
  return models?.[0] ?? null;
}

export function vendorOptionsForCatalog(
  catalog: AiGatewayCatalog | null | undefined,
  currentVendor: string
): { value: string; label: string }[] {
  const fromCatalog =
    catalog?.vendors.map((v) => ({ value: v.id, label: v.label })) ??
    [];
  if (currentVendor && !fromCatalog.some((o) => o.value === currentVendor)) {
    return [
      { value: currentVendor, label: formatGatewayVendorLabel(currentVendor) },
      ...fromCatalog,
    ];
  }
  return fromCatalog;
}
