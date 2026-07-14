export type BaseAdConcept = {
  mediaUrl: string;
  format: 'Video' | 'Image';
  story?: string | null;
  metadata: Record<string, unknown>;
  idea?: string;
  duration?: string;
  audioStyle?: string;
  videoStyle?: string;
  imageStyle?: string;
  character?: string;
  voiceId?: string;
  language?: string;
};

export type VariantConcept = {
  angle: string;
  idea: string;
  headline?: string;
  primary_text?: string;
  prompt?: string;
  title?: string;
  cta?: string;
};

export type AutomationStatus =
  | 'generating'
  | 'pending_review'
  | 'running'
  | 'evaluating'
  | 'paused'
  | 'error';

export type VariantRole = 'base' | 'challenger' | 'winner' | 'archived';

export type AdVariantPayload = {
  id: string;
  automationId: string;
  generation: number;
  metaAdId: string | null;
  mediaUrl: string;
  format: string;
  concept: Record<string, unknown>;
  metrics: Record<string, unknown> | null;
  role: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type AutomationPayload = {
  id: string;
  companyId: string;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  baseAdMediaUrl: string;
  baseConcept: Record<string, unknown>;
  numVariants: number;
  evalLengthDays: number;
  dailyBudgetCents: number;
  automationEnabled: boolean;
  status: string;
  generation: number;
  nextEvaluationAt: string | null;
  launchSchema: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  variants: AdVariantPayload[];
};

export const META_MIN_DAILY_BUDGET_CENTS = 100;
