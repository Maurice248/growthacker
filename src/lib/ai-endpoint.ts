import {
  AI_PROVIDER_DEFAULT_BASE_URLS,
  type AiProviderId,
} from '@/lib/ai-module-routing';

/**
 * Every supported provider speaks the OpenAI chat-completions shape, so the
 * chat helpers only need a key, a base URL, and an optional model override.
 */
export type AiEndpoint = {
  provider: AiProviderId;
  apiKey: string;
  baseUrl: string;
  /** Null keeps whatever model the calling pipeline asks for. */
  model: string | null;
};

/** Chat helpers accept either a raw OpenAI key (legacy) or a routed endpoint. */
export type AiCredential = string | AiEndpoint;

export function isAiEndpoint(value: AiCredential): value is AiEndpoint {
  return typeof value === 'object' && value !== null && 'apiKey' in value;
}

export function openAiEndpoint(apiKey: string): AiEndpoint {
  return {
    provider: 'openai',
    apiKey,
    baseUrl: AI_PROVIDER_DEFAULT_BASE_URLS.openai,
    model: null,
  };
}

export function toAiEndpoint(credential: AiCredential): AiEndpoint {
  return isAiEndpoint(credential) ? credential : openAiEndpoint(credential);
}
