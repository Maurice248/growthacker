import type { BrandProfileData } from '@/lib/brand-config';

export type CreateAdCompanyContext = {
  companyId: string;
  companyName: string;
  brand: BrandProfileData;
  destinationUrl: string;
};

export type CreateAdTokens = {
  openai: string | null;
  kie: string | null;
  assemblyai: string | null;
  uploadPost: string | null;
  elevenLabs: string | null;
};

export type CreateAdParams = {
  hookPattern?: string;
  angle?: string;
  framework?: string;
  gapOpportunity?: string;
  ctaPattern?: string;
};

export type AdItemInput = {
  id: number;
  type: 'video' | 'image';
  duration?: string;
  audioStyle?: string;
  videoStyle?: string;
  imageStyle?: string;
  language?: string;
  idea?: string;
  character?: string;
  voiceId?: string;
  adParams?: CreateAdParams;
};

export type IdeaResult = {
  id: number;
  type: string;
  angle: string;
  idea: string;
};

export type ImageAdConcept = {
  id: string | number;
  title: string;
  prompt: string;
  headline: string;
  cta: string;
};

export type KieTaskResult = {
  taskId: string;
  state: string;
  resultUrl: string | null;
  failMsg?: string | null;
  prompt?: string | null;
};

export type AdMetadata = {
  ad_id: number;
  ad_type: 'video' | 'image';
  ad_name: string;
  primary_text: string;
  headline: string;
  ad_description: string;
  destination_url: string;
};

export type VideoScene = {
  scene: number;
  script_line?: string;
  prompt: string;
  prompt_clean?: string;
  video_scenario?: string;
  phase?: number;
  emotion_type?: string;
  character?: string;
  character_image?: string;
  image_url?: string;
  video_url?: string;
  task_id?: string;
};

export type ReportData = Record<string, unknown>;

export type AdsConfig = {
  totalAds: number;
  videoCount: number;
  imageCount: number;
  items: AdItemInput[];
};
