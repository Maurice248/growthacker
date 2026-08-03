import { toAiEndpoint, type AiCredential } from '@/lib/ai-endpoint';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatCompletionOptions = {
  model?: string;
  jsonMode?: boolean;
  timeoutMs?: number;
};

export function parseJsonFromAiOutput(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw !== 'string') {
    throw new Error('AI output is not a string or object');
  }

  const cleaned = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as Record<string, unknown>;
    }
    throw new Error(`Could not parse AI output: ${raw.slice(0, 200)}`);
  }
}

export async function chatCompletion(
  credential: AiCredential,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const {
    model = 'gpt-4o-mini',
    jsonMode = true,
    timeoutMs = 180_000,
  } = options;

  const endpoint = toAiEndpoint(credential);

  const body: Record<string, unknown> = {
    model: endpoint.model || model,
    messages,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${endpoint.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`AI provider returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`AI provider returned invalid JSON: ${text.slice(0, 200)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI provider returned empty response');
  }

  return content;
}

export async function chatCompletionJson(
  credential: AiCredential,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<Record<string, unknown>> {
  const content = await chatCompletion(credential, messages, options);
  return parseJsonFromAiOutput(content);
}
