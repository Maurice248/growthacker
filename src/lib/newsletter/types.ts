export type NewsletterData = {
  subjectLine?: string;
  preheader?: string;
  headerTitle?: string;
  intro?: string;
  mainStory?: string;
  keyInsights?: string;
  industryUpdate?: string;
  proTip?: string;
  callToAction?: string;
  closing?: string;
  footerNote?: string;
  output?: string;
  content?: string;
  newsletter?: string;
};

export type NewsletterConfigData = {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  website: string;
  logoUrl: string;
  addressLine: string;
  phone: string;
  unsubscribeBaseUrl: string;
  sendHour: number;
  sendMinute: number;
  sendTimezone: string;
  dailyLimit: number;
  active: boolean;
};

export type NewsletterContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  productsServices: string;
  valueProposition: string;
  brandVoice: string;
  positioning: string;
  competitors: string;
  painPoints: string;
  icpNewsletter: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  website: string;
  logoUrl: string;
  addressLine: string;
  phone: string;
  unsubscribeBaseUrl: string;
  sendHour: number;
  sendMinute: number;
  sendTimezone: string;
  dailyLimit: number;
  active: boolean;
};

export type NewsletterTokens = {
  openai: string | null;
  resend: string | null;
};

export type CampaignAudienceLimit = '50' | '150' | '200' | 'All Subscribers';
