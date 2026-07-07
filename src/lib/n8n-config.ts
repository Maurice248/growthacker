/** n8n integration field definitions — env key is the storage key in n8nWebhooksJson */

export type N8nWebhookField = {
  key: string;
  label: string;
  group: string;
  description?: string;
};

export const N8N_WEBHOOK_FIELDS: N8nWebhookField[] = [
  { key: 'N8N_COMPETITOR_ANALYSIS_URL', label: 'Competitor analysis', group: 'Meta Ads' },
  { key: 'NEXT_PUBLIC_N8N_GENERATE_AD_URL', label: 'Generate ad', group: 'Meta Ads' },
  { key: 'NEXT_PUBLIC_N8N_ACCEPT_PROMPTS_URL', label: 'Accept prompts', group: 'Meta Ads' },
  { key: 'NEXT_PUBLIC_N8N_SINGLE_IDEA_URL', label: 'Single idea generation', group: 'Meta Ads' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_IMAGE_URL', label: 'Social image generation', group: 'Social Channels', description: 'Generates platform-ready social images in Creator Studio.' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_POST_URL', label: 'Social post', group: 'Social Channels', description: 'Publishes approved image campaigns to connected social platforms.' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_MANUAL_URL', label: 'Social manual story', group: 'Social Channels', description: 'Starts a manual video story workflow from your script inputs.' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_DYNAMIC_URL', label: 'Social dynamic story', group: 'Social Channels', description: 'Generates a dynamic video story from prompts and scene data.' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_ACCEPT_URL', label: 'Social accept story', group: 'Social Channels', description: 'Accepts a generated story and moves the video pipeline forward.' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_CONFIRM_PROMPTS_URL', label: 'Social confirm prompts', group: 'Social Channels', description: 'Confirms scene prompts before video generation runs.' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_RETRY_URL', label: 'Social retry', group: 'Social Channels', description: 'Retries failed image or story generation with updated prompts.' },
  { key: 'NEXT_PUBLIC_N8N_SOCIAL_POST_VIDEO_URL', label: 'Social post video', group: 'Social Channels', description: 'Publishes completed video content to connected social platforms.' },
  { key: 'NEXT_PUBLIC_N8N_GENERATE_WEBHOOK_URL', label: 'Generate newsletter', group: 'Newsletter' },
  { key: 'NEXT_PUBLIC_N8N_REGENERATE_WEBHOOK_URL', label: 'Regenerate newsletter', group: 'Newsletter' },
  { key: 'NEXT_PUBLIC_N8N_HTML_WEBHOOK_URL', label: 'Newsletter HTML', group: 'Newsletter' },
  { key: 'NEXT_PUBLIC_N8N_CAMPAIGN_WEBHOOK_URL', label: 'Newsletter campaign', group: 'Newsletter' },
  { key: 'N8N_CAMPAIGN_WEBHOOK_URL', label: 'Cold Email campaign', group: 'Cold Email' },
  { key: 'N8N_SCRAPER_WEBHOOK_URL', label: 'Lead scraper', group: 'Cold Email' },
  { key: 'N8N_CLEANUP_WEBHOOK_URL', label: 'Lead cleanup', group: 'Cold Email' },
  { key: 'N8N_APPROVAL_WEBHOOK_URL', label: 'Campaign approval', group: 'Cold Email' },
  { key: 'N8N_BLOG_AUTOMATION_WEBHOOK_URL', label: 'Blog automation', group: 'Blog' },
];

export const SOCIAL_N8N_WEBHOOK_FIELDS = N8N_WEBHOOK_FIELDS.filter(
  (field) => field.group === 'Social Channels'
);

export type N8nWebhooksMap = Record<string, string>;

export type ResolvedN8nConfig = {
  apiKey: string | null;
  apiBaseUrl: string;
  blogWorkflowId: string;
  blogWorkflowName: string;
  webhooks: N8nWebhooksMap;
};

export const DEFAULT_BLOG_WORKFLOW_ID = 'Kgt5aL2eaVYIyNMo';
export const DEFAULT_BLOG_WORKFLOW_NAME = 'Blogs';

export function webhooksFromEnv(): N8nWebhooksMap {
  const map: N8nWebhooksMap = {};
  for (const field of N8N_WEBHOOK_FIELDS) {
    const value = process.env[field.key]?.trim();
    if (value) map[field.key] = value;
  }
  return map;
}

export function parseWebhooksJson(value: unknown): N8nWebhooksMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const map: N8nWebhooksMap = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string' && val.trim()) map[key] = val.trim();
  }
  return map;
}

export function groupN8nWebhookFields() {
  const groups = new Map<string, N8nWebhookField[]>();
  for (const field of N8N_WEBHOOK_FIELDS) {
    const list = groups.get(field.group) ?? [];
    list.push(field);
    groups.set(field.group, list);
  }
  return groups;
}

export function isN8nConfigured(config: ResolvedN8nConfig): boolean {
  return Boolean(
    config.apiKey || config.apiBaseUrl || Object.keys(config.webhooks).length > 0
  );
}
