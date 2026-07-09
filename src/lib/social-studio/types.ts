export type SocialStudioTokens = {
  openai: string | null;
  kie: string | null;
  assemblyai: string | null;
  uploadPost: string | null;
  elevenLabs: string | null;
};

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'x' | 'youtube';

export type SocialStudioConfigData = {
  brandAbout: string;
  brandMission: string;
  brandServices: string;
  brandAudience: string;
  brandWebsite: string;
  tone: string;
  defaultImageRatio: string;
  uploadPostUser: string;
  facebookPageId: string;
  linkedinOrgUrn: string;
  tiktokHandle: string;
  enabledPlatforms: SocialPlatform[];
};

export type SocialStudioContext = SocialStudioConfigData & {
  companyId: string;
  companyName: string;
};

export type SocialScene = {
  scene: number;
  script_line: string;
  prompt: string;
  prompt_clean: string;
  video_scenario: string;
  image_url?: string;
  video_url?: string;
};

export type PlatformDescriptions = {
  facebook: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  twitter: string;
  youtube?: string;
};

export type SocialMetadata = {
  video_title: string;
  post: string;
  tags: string;
  caption: string;
};

export type VideoFormInput = {
  character?: string;
  category?: string;
  description?: string;
  videoStyle?: string;
  language?: string;
  voice?: string;
  backgroundSong?: string;
  duration?: string | number;
};

export type KieTaskResult = {
  taskId: string;
  state: string;
  resultUrl: string | null;
  failMsg: string | null;
  prompt: string | null;
  index?: number;
};
