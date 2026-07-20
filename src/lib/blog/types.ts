export type BlogTokens = {
  openai: string | null;
  kie: string | null;
  dataforseo: string | null;
};

export type BlogConfigData = {
  titlePrompt: string;
  titleUserPrompt: string;
  articleSystemPrompt: string;
  articleUserPrompt: string;
  imagePromptSystem: string;
  runHour: number;
  runMinute: number;
  runTimezone: string;
  daysInterval: number;
  active: boolean;
  postStatus: string;
  imageSize: string;
  dataForSeoLocationCode: number;
  openAiModel: string;
  lastCategoryIndex: number;
  lastRunAt: string | null;
};

export type BlogCategoryData = {
  id: string;
  service: string;
  category: string;
  seedKeyword: string;
  keywords: string[];
  sortOrder: number;
  active: boolean;
};

export type BlogContext = {
  companyName: string;
  companySlug: string;
  destinationUrl: string;
  productsServices: string;
  valueProposition: string;
  brandVoice: string;
  positioning: string;
  painPoints: string;
  competitors: string;
  icpBlog: string;
  openAiModel: string;
  postStatus: string;
  imageSize: string;
  dataForSeoLocationCode: number;
};

export type BlogOutline = {
  selected_keywords: string[];
  main_keyword_for_url: string;
  title: string;
  meta_title: string;
  meta_description: string;
  url: string;
  summary: string;
  introduction: string;
  body_sections: Array<{
    h2: string;
    description: string;
    keywords: string[];
    subsections: Array<{ h3: string; description: string }>;
  }>;
  conclusion: string;
  cta: string;
};

export type BlogArticle = {
  title: string;
  meta_title: string;
  meta_description: string;
  url: string;
  article: string;
};

export type BlogImageMeta = {
  image_prompt: string;
  title: string;
  alt_text: string;
  description: string;
  caption: string;
};

export type BlogJobStatus =
  | 'pending'
  | 'keywords'
  | 'writing'
  | 'image'
  | 'publishing'
  | 'done'
  | 'error';

export type BlogJobView = {
  id: string;
  status: BlogJobStatus;
  title: string | null;
  slug: string | null;
  imageUrl: string | null;
  wordpressPostId: number | null;
  wordpressPostUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};
