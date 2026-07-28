export type SocialStudioTokens = {
  openai: string | null;
  kie: string | null;
  assemblyai: string | null;
  uploadPost: string | null;
  elevenLabs: string | null;
};

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'x' | 'youtube';

export type SocialStudioPostingConfig = {
  defaultImageRatio: string;
  uploadPostUser: string;
  facebookPageId: string;
  linkedinOrgUrn: string;
  tiktokHandle: string;
  enabledPlatforms: SocialPlatform[];
};

/** Brand copy injected into Creator Studio prompts — resolved from Configuration → Brand and ICP. */
export type SocialStudioBrandPromptContext = {
  brandAbout: string;
  brandMission: string;
  brandServices: string;
  brandAudience: string;
  brandWebsite: string;
  tone: string;
};

/** Full persisted row shape (legacy brand columns remain in DB but are not edited from Social Overview). */
export type SocialStudioConfigData = SocialStudioPostingConfig & SocialStudioBrandPromptContext;

export type SocialStudioContext = SocialStudioPostingConfig &
  SocialStudioBrandPromptContext & {
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
