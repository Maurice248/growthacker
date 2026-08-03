import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { getCompanyAiRouting } from '@/lib/ai-routing-store';
import { openAiEndpoint, type AiEndpoint } from '@/lib/ai-endpoint';
import {
  AI_MODULE_LABELS,
  AI_PROVIDER_DEFAULT_BASE_URLS,
  AI_PROVIDER_LABELS,
  isGatewayProvider,
  selectedRouteModel,
  type AiModuleId,
} from '@/lib/ai-module-routing';

/**
 * Resolves the provider/model a company picked for a module in Settings → API Keys.
 * Falls back to the module's own OpenAI key while routing has never been saved.
 */
export async function resolveModuleAi(
  companyId: string,
  moduleId: AiModuleId,
  fallbackOpenAiKey?: string | null
): Promise<AiEndpoint> {
  const [routing, secrets] = await Promise.all([
    getCompanyAiRouting(companyId),
    getCompanyApiTokenSecrets(companyId),
  ]);

  if (!routing.configured) {
    const key = secrets.openai?.trim() || fallbackOpenAiKey?.trim() || '';
    if (!key) {
      throw new Error('OpenAI is not configured. Add it in Settings → API Keys.');
    }
    return openAiEndpoint(key);
  }

  const route = routing.routes[moduleId];
  const provider = route.selected;
  const apiKey = secrets[provider]?.trim() || '';

  if (!apiKey) {
    const where = isGatewayProvider(provider) ? 'AI Gateways' : 'API Keys';
    throw new Error(
      `${AI_PROVIDER_LABELS[provider]} is selected for ${AI_MODULE_LABELS[moduleId]} but has no API key. Add it in Settings → ${where}.`
    );
  }

  const configuredBaseUrl =
    provider === 'openrouter'
      ? routing.connection.openrouterBaseUrl
      : provider === 'vercelAiGateway'
        ? routing.connection.vercelGatewayBaseUrl
        : '';

  return {
    provider,
    apiKey,
    baseUrl:
      configuredBaseUrl.trim().replace(/\/+$/, '') || AI_PROVIDER_DEFAULT_BASE_URLS[provider],
    model: selectedRouteModel(route),
  };
}
