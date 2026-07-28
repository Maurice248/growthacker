export type CompetitorAnalysisInput = {
  topic?: string;
  keywords: string[];
  countries: string[];
  max_ads?: number;
  only_active?: boolean;
  sort?: string;
  /** When both true (default), Ads Library uses media_type=all. */
  scrape_image?: boolean;
  scrape_video?: boolean;
  brand_config?: unknown;
  brand_snapshot_id?: string | null;
  timestamp?: string;
};

export type ProcessedAd = {
  ad_id: string;
  page_name: string;
  page_url: string;
  ad_type: string;
  start_date: string;
  platforms: string;
  copy: {
    hook: string;
    headline: string;
    body: string;
    cta: string;
    caption: string;
  };
  script: {
    framework: string;
    est_read_time: string;
    has_urgency: boolean;
    has_proof: boolean;
    has_savings: boolean;
    has_cta: boolean;
    has_local: boolean;
  };
  angles: string[];
  hashtags: string[];
  strength: string;
  score: number;
  image_url: string;
  has_video: boolean;
};

export type ProcessedAdsResult = {
  meta: {
    generated_at: string;
    total_scraped: number;
    total_relevant: number;
    total_competitors: number;
    skipped: { deleted: number; irrelevant: number; template: number };
  };
  summary: {
    formats: {
      video: number;
      image: number;
      carousel: number;
      text: number;
      video_pct: string;
      carousel_pct: string;
    };
    top_angles: Array<{ val: string; count: number }>;
    top_frameworks: Array<{ val: string; count: number }>;
    top_ctas: Array<{ val: string; count: number }>;
    top_hashtags: Array<{ val: string; count: number }>;
    gaps: Record<string, boolean>;
  };
  competitors: Array<Record<string, unknown>>;
  top_ads: Array<Record<string, unknown>>;
  all_ads: ProcessedAd[];
};

export type AnalysisReport = {
  success: boolean;
  topic?: string;
  executive_summary: string;
  competitors_table: Array<{
    name: string;
    ads: number;
    score: number | string;
    threat: string;
    angle: string;
    hook: string;
  }>;
  hooks_table: Array<{
    pattern: string;
    example: string;
    reason: string;
    score: number | string;
  }>;
  market_insights_table: Array<{ field: string; value: string }>;
  gaps_table: Array<{
    gap: string;
    opportunity: string;
    priority: string;
    impact: string;
    ad_format?: string;
  }>;
  ready_ad_scripts?: Array<{
    title?: string;
    format?: string;
    script?: string;
    idea?: string;
    storyboard?: string;
    text?: string;
    narrative?: string;
    competitor_hook_referenced?: string;
    target_audience?: string;
    ad_format?: string;
    type?: string;
  }>;
  action_plan?: Array<{
    priority?: number;
    week?: string;
    action?: string;
    format?: string;
    expected_outcome?: string;
  }>;
  budget_recommendation?: {
    best_ad_format_to_start?: string;
    recommended_daily_budget?: string;
    recommended_duration_days?: string;
    best_platform?: string;
  };
  error?: string;
  details?: string;
};
