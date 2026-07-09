export type ColdEmailTokens = {
  openai: string | null;
  apify: string | null;
  millionVerifier: string | null;
  instantly: string | null;
};

export type OutreachConfigData = {
  instantlyCampaignId: string;
  senderName: string;
  defaultCtaLink: string;
  cleanupIntervalDays: number;
  cleanupBatchSize: number;
  dailySendLimit: number;
  active: boolean;
};

export type OutreachContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  productsServices: string;
  valueProposition: string;
  brandVoice: string;
  positioning: string;
  competitors: string;
  painPoints: string;
  icpOutreach: string;
  destinationUrl: string;
  instantlyCampaignId: string;
  senderName: string;
  defaultCtaLink: string;
  dailySendLimit: number;
};

export type CampaignGenerateInput = {
  campaign_name: string;
  service_type: string;
  target_region: string;
  campaign_goal: string;
  campaign_message: string;
  cta_button_text: string;
  cta_link?: string;
  tone: string;
  selected_sheet: string;
  lead_list_id?: string;
};

export type CampaignAiContent = {
  campaign_name: string;
  service_type: string;
  subject_line: string;
  preview_text: string;
  header_title: string;
  greeting: string;
  opening: string;
  main_content: string;
  cta: string;
  closing: string;
  footer_note: string;
  full_email_body: string;
  body_preview: string;
};

export type ScraperInput = {
  niches: string;
  location: string;
  max_results: number;
  target_sheet: string;
  list_id?: string;
};

export type ScraperResult = {
  status: string;
  execution_id?: string;
  timestamp: string;
  execution_time_seconds?: number;
  supabase_info: {
    table_name: string;
    total_leads_requested: number;
    total_leads_scraped: number;
    save_status: string;
  };
  email_verification_stats: {
    verified: number;
    catch_all: number;
    invalid: number;
    unknown: number;
    bounce_risk_removed: number;
  };
  scraper_summary: {
    niches: string;
    location: string;
    total_scraped: number;
    verified_leads: number;
    invalid_leads: number;
    unknown_leads: number;
    success_rate: string;
  };
};

export type ApifyLeadRow = {
  first_name?: string;
  last_name?: string;
  personal_email?: string;
  email?: string;
  mobile_number?: string;
  linkedin?: string;
  city?: string;
  country?: string;
};
