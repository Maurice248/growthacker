import type { Prisma } from '@prisma/client';
import { chatCompletionJson } from '@/lib/social-studio/openai';
import { kieCreateImageTask, kieRecordInfo } from '@/lib/social-studio/kie';
import {
  createWordPressPost,
  fetchImageBytes,
  listWordPressCategories,
  updateWordPressPost,
  updateWordPressMediaMeta,
  uploadWordPressMedia,
} from '@/lib/wordpress';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import { advanceCategoryRotation, getBlogCategoryById } from './categories';
import { ensureBlogConfig, getBlogConfig, resolveBlogContext } from './company-context';
import { researchKeywordsForSeeds } from './dataforseo';
import {
  cleanupArticleHtml,
  insertImageAfterFirstHeading,
  markdownToHtml,
  postProcessArticleMarkdown,
  prepareOutlineForArticle,
} from './html';
import {
  BLOG_IMAGE_WAIT_MAX_MS,
  BLOG_JOB_MAX_PHASE_ATTEMPTS,
  claimBlogJob,
  createBlogJob,
  getBlogJob,
  jobToView,
  parseBlogJobInput,
  releaseBlogJobLease,
  updateBlogJob,
  type BlogJobInput,
} from './jobs';
import {
  BLOG_ARTICLE_JSON_SCHEMA,
  BLOG_OUTLINE_JSON_SCHEMA,
  normalizeBlogOutline,
  normalizeBlogOutlineWithFallback,
} from './outline';
import {
  buildDefaultArticleUserPrompt,
  buildDefaultImageUserPrompt,
  buildDefaultTitleUserPrompt,
  buildWpCategoryPrompt,
  getArticlePrompts,
  getImagePrompts,
  getTitlePrompts,
  substitutePromptTemplate,
} from './prompts';
import { getBlogTokens, getBlogWordPressConfig, requireToken } from './tokens';
import type {
  BlogArticle,
  BlogCategoryData,
  BlogImageMeta,
  BlogJobStatus,
  BlogJobView,
  BlogOutline,
  BlogTokens,
} from './types';

const OUTLINE_TIMEOUT_MS = 120_000;
const ARTICLE_TIMEOUT_MS = 240_000;
const IMAGE_META_TIMEOUT_MS = 90_000;
const OUTLINE_PHASE_BUDGET_MS = 250_000;

/** Worst-case phase budgets used by the worker deadline guard. */
export const BLOG_PHASE_BUDGET_MS: Partial<Record<BlogJobStatus, number>> = {
  pending: 90_000,
  keywords: 90_000,
  outline: OUTLINE_PHASE_BUDGET_MS,
  writing: ARTICLE_TIMEOUT_MS + 30_000,
  image_prompt: IMAGE_META_TIMEOUT_MS + 45_000,
  image: 45_000,
  publishing: 120_000,
};

export type AdvanceBlogJobResult = {
  job: BlogJobView;
  busy?: boolean;
  advanced?: boolean;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function asOutline(value: unknown): BlogOutline | null {
  if (!value || typeof value !== 'object') return null;
  return value as BlogOutline;
}

function asImageMeta(value: unknown, fallbackTitle: string, fallbackPrompt: string): BlogImageMeta {
  if (value && typeof value === 'object') {
    const meta = value as Partial<BlogImageMeta>;
    return {
      image_prompt: String(meta.image_prompt || fallbackPrompt || ''),
      title: String(meta.title || fallbackTitle || ''),
      alt_text: String(meta.alt_text || fallbackTitle || ''),
      description: String(meta.description || ''),
      caption: String(meta.caption || ''),
    };
  }
  return {
    image_prompt: fallbackPrompt || '',
    title: fallbackTitle || '',
    alt_text: fallbackTitle || '',
    description: '',
    caption: '',
  };
}

async function generateOutline(
  companyId: string,
  tokens: BlogTokens,
  category: BlogCategoryData,
  rankedKeywords: string[]
): Promise<BlogOutline> {
  const ctx = await resolveBlogContext(companyId);
  const config = await ensureBlogConfig(companyId);
  const ai = await resolveModuleAi(companyId, 'blog', tokens.openai);
  const titlePrompts = getTitlePrompts(ctx, config.titlePrompt, config.titleUserPrompt);

  const userPrompt = titlePrompts.userTemplate
    ? substitutePromptTemplate(titlePrompts.userTemplate, {
        category: category.category,
        service: category.service,
        seedKeyword: category.seedKeyword,
        rankedKeywords,
        keywords: category.keywords,
        today: todayIso(),
      })
    : buildDefaultTitleUserPrompt(
        ctx,
        category.category,
        category.service,
        category.seedKeyword,
        category.keywords,
        rankedKeywords,
        todayIso()
      );

  const systemPrompt = `${titlePrompts.system}\n\n${BLOG_OUTLINE_JSON_SCHEMA}`;
  const deadline = Date.now() + OUTLINE_PHASE_BUDGET_MS;
  let lastRaw: Record<string, unknown> | null = null;
  let attempt = 0;

  while (Date.now() + OUTLINE_TIMEOUT_MS <= deadline) {
    attempt += 1;
    const retryNote =
      attempt > 1
        ? '\n\nRETRY REQUIRED: Your previous JSON was missing the required body_sections array. Return valid JSON with 3-5 objects in body_sections. Each object must include h2, description, keywords, and subsections.'
        : '';

    const parsed = await chatCompletionJson(
      ai,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${userPrompt}${retryNote}` },
      ],
      {
        model: ai.model || ctx.openAiModel || 'gpt-4o-mini',
        jsonMode: true,
        timeoutMs: OUTLINE_TIMEOUT_MS,
      }
    );
    lastRaw = parsed;

    try {
      return normalizeBlogOutline(parsed);
    } catch (error) {
      const missingSections =
        error instanceof Error && error.message === 'OUTLINE_MISSING_BODY_SECTIONS';
      if (!missingSections) break;
      console.warn(`[blog] outline attempt ${attempt} missing body_sections, retrying`);
    }
  }

  return normalizeBlogOutlineWithFallback(lastRaw, category, rankedKeywords);
}

async function generateArticle(
  companyId: string,
  tokens: BlogTokens,
  outline: BlogOutline
): Promise<BlogArticle> {
  const ctx = await resolveBlogContext(companyId);
  const config = await ensureBlogConfig(companyId);
  const ai = await resolveModuleAi(companyId, 'blog', tokens.openai);
  const prepared = prepareOutlineForArticle(outline);
  const articlePrompts = getArticlePrompts(ctx, config.articleSystemPrompt, config.articleUserPrompt);

  const userPrompt = articlePrompts.userTemplate
    ? substitutePromptTemplate(articlePrompts.userTemplate, {
        title: prepared.title,
        meta_title: prepared.meta_title,
        meta_description: prepared.meta_description,
        url: prepared.url,
        selected_keywords: prepared.selected_keywords,
        main_keyword_for_url: prepared.main_keyword_for_url,
        summary: prepared.summary,
        introduction_description: prepared.introduction_description,
        body_sections_text: prepared.body_sections_text,
        conclusion_description: prepared.conclusion_description,
        cta: prepared.cta,
        today: todayIso(),
      })
    : buildDefaultArticleUserPrompt(prepared as BlogOutline, todayIso(), ctx);

  const parsed = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: `${articlePrompts.system}\n\n${BLOG_ARTICLE_JSON_SCHEMA}` },
      { role: 'user', content: userPrompt },
    ],
    {
      model: ai.model || ctx.openAiModel || 'gpt-4o-mini',
      jsonMode: true,
      timeoutMs: ARTICLE_TIMEOUT_MS,
    }
  );

  const article = String(parsed.article || '');
  const processed = postProcessArticleMarkdown(article, prepared.body_sections_text);
  return {
    title: String(parsed.title || outline.title),
    meta_title: String(parsed.meta_title || outline.meta_title),
    meta_description: String(parsed.meta_description || outline.meta_description),
    url: String(parsed.url || outline.url),
    article: processed,
  };
}

async function articleToHtml(article: BlogArticle, _outline: BlogOutline): Promise<string> {
  const html = markdownToHtml(article.article);
  const withTitle = `<h1>${article.title}</h1>\n${html}`;
  return cleanupArticleHtml(withTitle);
}

async function generateImageMeta(
  companyId: string,
  tokens: BlogTokens,
  articleHtml: string
): Promise<BlogImageMeta> {
  const ctx = await resolveBlogContext(companyId);
  const config = await ensureBlogConfig(companyId);
  const ai = await resolveModuleAi(companyId, 'blog', tokens.openai);
  const imagePrompts = getImagePrompts(ctx, config.imagePromptSystem);

  const parsed = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: imagePrompts.system },
      { role: 'user', content: buildDefaultImageUserPrompt(articleHtml) },
    ],
    {
      model: ai.model || ctx.openAiModel || 'gpt-4o-mini',
      jsonMode: true,
      timeoutMs: IMAGE_META_TIMEOUT_MS,
    }
  );

  return {
    image_prompt: String(parsed.image_prompt || parsed['image prompt'] || ''),
    title: String(parsed.title || ''),
    alt_text: String(parsed.alt_text || parsed['alt_text for image'] || ''),
    description: String(parsed.description || ''),
    caption: String(parsed.caption || ''),
  };
}

async function resolveWpCategoryId(
  companyId: string,
  tokens: BlogTokens,
  articleText: string,
  wpConfig: NonNullable<Awaited<ReturnType<typeof getBlogWordPressConfig>>>
): Promise<number | undefined> {
  try {
    const categories = await listWordPressCategories(wpConfig);
    if (!categories.length) return undefined;

    const ctx = await resolveBlogContext(companyId);
    const ai = await resolveModuleAi(companyId, 'blog', tokens.openai);
    const parsed = await chatCompletionJson(
      ai,
      [
        {
          role: 'system',
          content: 'Return JSON with category_id as a number for the best matching WordPress category.',
        },
        { role: 'user', content: buildWpCategoryPrompt(articleText, categories) },
      ],
      { model: ai.model || ctx.openAiModel || 'gpt-4o-mini', jsonMode: true, timeoutMs: 60_000 }
    );

    const id = Number(parsed.category_id);
    if (!Number.isFinite(id) || id <= 0) return undefined;
    return id;
  } catch {
    return undefined;
  }
}

async function requireJobCategory(
  companyId: string,
  categoryId: string | null
): Promise<BlogCategoryData> {
  if (!categoryId) throw new Error('Job is missing categoryId');
  const category = await getBlogCategoryById(companyId, categoryId);
  if (!category) throw new Error('Invalid category ID');
  return category;
}

async function phaseKeywords(
  companyId: string,
  jobId: string,
  categoryId: string | null,
  input: BlogJobInput
) {
  const tokens = await getBlogTokens(companyId);
  requireToken(tokens, 'dataforseo', 'DataForSEO');
  const category = await requireJobCategory(companyId, categoryId);
  const ctx = await resolveBlogContext(companyId);
  const seeds = [category.seedKeyword, ...category.keywords].filter(Boolean);

  let rankedKeywordStrings: string[];
  try {
    const ranked = await researchKeywordsForSeeds(
      requireToken(tokens, 'dataforseo', 'DataForSEO'),
      seeds,
      ctx.dataForSeoLocationCode
    );
    rankedKeywordStrings = ranked.map((k) => k.keyword);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const authFailed =
      message.includes('authentication failed') || message.includes('HTTP 401');
    if (!authFailed) throw error;
    console.warn('[blog/generate] DataForSEO unavailable, using category keywords:', message);
    rankedKeywordStrings = [...new Set(seeds)];
  }

  const nextInput = {
    ...input,
    rankedKeywords: rankedKeywordStrings,
    category: category.category,
    service: category.service,
  };
  delete (nextInput as BlogJobInput)._lease;

  await updateBlogJob(jobId, companyId, {
    status: 'outline',
    input: nextInput as Prisma.InputJsonValue,
  });
}

async function phaseOutline(
  companyId: string,
  jobId: string,
  categoryId: string | null,
  input: BlogJobInput
) {
  const tokens = await getBlogTokens(companyId);
  const category = await requireJobCategory(companyId, categoryId);
  const rankedKeywords = Array.isArray(input.rankedKeywords)
    ? (input.rankedKeywords as string[])
    : [category.seedKeyword, ...category.keywords].filter(Boolean);

  const outline = await generateOutline(companyId, tokens, category, rankedKeywords);
  const nextInput = { ...input, outline, rankedKeywords };
  delete (nextInput as BlogJobInput)._lease;

  await updateBlogJob(jobId, companyId, {
    status: 'writing',
    title: outline.title,
    slug: outline.url,
    input: nextInput as Prisma.InputJsonValue,
  });
}

async function phaseWriting(
  companyId: string,
  jobId: string,
  input: BlogJobInput
) {
  const tokens = await getBlogTokens(companyId);
  const outline = asOutline(input.outline);
  if (!outline) throw new Error('Job is missing outline data');

  const article = await generateArticle(companyId, tokens, outline);
  const articleHtml = await articleToHtml(article, outline);
  const nextInput = { ...input, outline, article };
  delete (nextInput as BlogJobInput)._lease;

  await updateBlogJob(jobId, companyId, {
    status: 'image_prompt',
    title: article.title,
    slug: article.url,
    articleHtml,
    input: nextInput as Prisma.InputJsonValue,
  });
}

async function phaseImagePrompt(
  companyId: string,
  jobId: string,
  articleHtml: string | null,
  input: BlogJobInput
) {
  if (!articleHtml) throw new Error('Job is missing articleHtml');

  const tokens = await getBlogTokens(companyId);
  requireToken(tokens, 'kie', 'KIE');
  const ctx = await resolveBlogContext(companyId);
  const imageMeta = await generateImageMeta(companyId, tokens, articleHtml);
  if (!imageMeta.image_prompt.trim()) {
    throw new Error('Image prompt generation returned an empty prompt');
  }

  const kieKey = requireToken(tokens, 'kie', 'KIE');
  const taskId = await kieCreateImageTask(kieKey, imageMeta.image_prompt, ctx.imageSize);
  const nextInput = {
    ...input,
    imageMeta,
    _imageWaitStartedAt: new Date().toISOString(),
  };
  delete (nextInput as BlogJobInput)._lease;

  await updateBlogJob(jobId, companyId, {
    status: 'image',
    imagePrompt: imageMeta.image_prompt,
    imageTaskId: taskId,
    input: nextInput as Prisma.InputJsonValue,
  });
}

async function phaseImage(
  companyId: string,
  jobId: string,
  imageTaskId: string | null,
  input: BlogJobInput
) {
  if (!imageTaskId) throw new Error('Job is missing imageTaskId');

  const tokens = await getBlogTokens(companyId);
  const kieKey = requireToken(tokens, 'kie', 'KIE');
  const result = await kieRecordInfo(kieKey, imageTaskId);

  if (result.state === 'fail' || result.state === 'failed') {
    throw new Error(result.failMsg || 'Image generation failed');
  }

  if (result.state !== 'success') {
    const startedAt = input._imageWaitStartedAt
      ? Date.parse(input._imageWaitStartedAt)
      : Date.now();
    const waitStarted = Number.isFinite(startedAt) ? startedAt : Date.now();
    if (Date.now() - waitStarted > BLOG_IMAGE_WAIT_MAX_MS) {
      throw new Error('Image generation timed out waiting for kie.ai');
    }

    // Soft wait: image still rendering. Do not burn phase retry budget.
    const attempts = { ...(input._attempts || {}) };
    delete attempts.image;
    const nextInput = {
      ...input,
      _attempts: attempts,
      _imageWaitStartedAt: input._imageWaitStartedAt || new Date(waitStarted).toISOString(),
    };
    delete (nextInput as BlogJobInput)._lease;
    await updateBlogJob(jobId, companyId, {
      status: 'image',
      input: nextInput as Prisma.InputJsonValue,
    });
    return;
  }

  const imageUrl = result.resultUrl;
  if (!imageUrl) throw new Error('Image generation succeeded but no URL returned');

  const nextInput = { ...input };
  delete (nextInput as BlogJobInput)._lease;
  await updateBlogJob(jobId, companyId, {
    imageUrl,
    status: 'publishing',
    input: nextInput as Prisma.InputJsonValue,
  });
}

async function phasePublishing(
  companyId: string,
  jobId: string,
  job: {
    title: string | null;
    slug: string | null;
    articleHtml: string | null;
    imageUrl: string | null;
    imagePrompt: string | null;
    categoryId: string | null;
  },
  input: BlogJobInput,
  options?: { advanceCategoryOnSuccess?: boolean }
) {
  if (!job.articleHtml || !job.title || !job.slug) {
    throw new Error('Job is missing required publish data');
  }
  if (!job.imageUrl) {
    throw new Error('Job is missing imageUrl');
  }

  const tokens = await getBlogTokens(companyId);
  const wpConfig = await getBlogWordPressConfig(companyId);
  if (!wpConfig) throw new Error('WordPress is not configured');

  const config = await getBlogConfig(companyId);
  const imageMeta = asImageMeta(input.imageMeta, job.title, job.imagePrompt || '');

  let contentWithImage = insertImageAfterFirstHeading(
    job.articleHtml,
    job.imageUrl,
    imageMeta.alt_text || job.title
  );

  const wpCategoryId = await resolveWpCategoryId(companyId, tokens, contentWithImage, wpConfig);

  const post = await createWordPressPost(
    {
      title: job.title,
      content: contentWithImage,
      slug: job.slug,
      status: (config?.postStatus as 'publish' | 'draft') || 'publish',
      categories: wpCategoryId ? [wpCategoryId] : undefined,
    },
    wpConfig
  );

  let postLink = post.link;

  try {
    const { bytes, mimeType } = await fetchImageBytes(job.imageUrl);
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const media = await uploadWordPressMedia(bytes, `featured-${job.slug}.${ext}`, mimeType, wpConfig);
    await updateWordPressMediaMeta(
      media.id,
      {
        alt_text: imageMeta.alt_text,
        caption: imageMeta.caption,
        description: imageMeta.description,
        title: imageMeta.title,
      },
      wpConfig
    );
    const updatedContent = insertImageAfterFirstHeading(
      job.articleHtml,
      media.source_url,
      imageMeta.alt_text || job.title
    );
    const updatedPost = await updateWordPressPost(
      post.id,
      {
        content: updatedContent,
        featured_media: media.id,
      },
      wpConfig
    );
    postLink = updatedPost.link;
    contentWithImage = updatedContent;
  } catch (mediaError) {
    console.warn('[blog] Featured media upload failed, post created without featured image:', mediaError);
  }

  const nextInput = { ...input };
  delete (nextInput as BlogJobInput)._lease;

  await updateBlogJob(jobId, companyId, {
    status: 'done',
    wordpressPostId: post.id,
    wordpressPostUrl: postLink,
    articleHtml: contentWithImage,
    errorMessage: null,
    input: nextInput as Prisma.InputJsonValue,
  });

  if (options?.advanceCategoryOnSuccess) {
    await advanceCategoryRotation(companyId);
  }
}

/**
 * Enqueue a blog job only. Phases are advanced by `/api/blog/job` polling
 * or the daily `/api/blog/cron/generate` advance pass (Hobby-safe).
 */
export async function startBlogGeneration(
  companyId: string,
  options: { categoryId: string; scheduled?: boolean }
): Promise<{ jobId: string }> {
  const tokens = await getBlogTokens(companyId);
  await resolveModuleAi(companyId, 'blog', tokens.openai);
  requireToken(tokens, 'kie', 'KIE');
  requireToken(tokens, 'dataforseo', 'DataForSEO');

  const wpConfig = await getBlogWordPressConfig(companyId);
  if (!wpConfig) {
    throw new Error('WordPress is not configured. Add credentials in API Keys.');
  }

  const category = await getBlogCategoryById(companyId, options.categoryId);
  if (!category) {
    throw new Error('Invalid category ID');
  }

  const job = await createBlogJob(companyId, category.id, {
    category: category.category,
    service: category.service,
    ...(options.scheduled ? { _scheduled: true } : {}),
  });

  return { jobId: job.id };
}

export async function advanceBlogJob(
  companyId: string,
  jobId: string
): Promise<AdvanceBlogJobResult> {
  const existing = await getBlogJob(jobId, companyId);
  if (!existing) throw new Error('Job not found');

  if (existing.status === 'done') {
    return { job: jobToView(existing), advanced: false };
  }
  if (existing.status === 'error') {
    throw new Error(existing.errorMessage || 'Blog generation failed');
  }

  const claimed = await claimBlogJob(existing);
  if (!claimed) {
    const current = await getBlogJob(jobId, companyId);
    return {
      job: jobToView(current || existing),
      busy: true,
      advanced: false,
    };
  }

  const { job, attempt, input } = claimed;
  const status = job.status as BlogJobStatus;

  if (attempt > BLOG_JOB_MAX_PHASE_ATTEMPTS) {
    await updateBlogJob(jobId, companyId, {
      status: 'error',
      errorMessage: `Phase "${status}" failed after ${BLOG_JOB_MAX_PHASE_ATTEMPTS} attempts`,
    });
    const errored = await getBlogJob(jobId, companyId);
    throw new Error(errored?.errorMessage || `Phase "${status}" failed`);
  }

  try {
    // Legacy jobs left in "keywords" use the same research step as "pending".
    if (status === 'pending' || status === 'keywords') {
      await phaseKeywords(companyId, jobId, job.categoryId, input);
    } else if (status === 'outline') {
      await phaseOutline(companyId, jobId, job.categoryId, input);
    } else if (status === 'writing') {
      await phaseWriting(companyId, jobId, input);
    } else if (status === 'image_prompt') {
      await phaseImagePrompt(companyId, jobId, job.articleHtml, input);
    } else if (status === 'image') {
      await phaseImage(companyId, jobId, job.imageTaskId, input);
    } else if (status === 'publishing') {
      await phasePublishing(companyId, jobId, job, input, {
        // Only cron-enqueued jobs rotate categories after a successful publish.
        advanceCategoryOnSuccess: input._scheduled === true,
      });
    } else {
      throw new Error(`Unknown blog job status: ${status}`);
    }

    const updated = await getBlogJob(jobId, companyId);
    return { job: jobToView(updated!), advanced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Blog generation failed';
    const nextInput = parseBlogJobInput(input);
    delete nextInput._lease;

    if (attempt >= BLOG_JOB_MAX_PHASE_ATTEMPTS) {
      await updateBlogJob(jobId, companyId, {
        status: 'error',
        errorMessage: `Phase "${status}" failed: ${message}`,
        input: nextInput as Prisma.InputJsonValue,
      });
      throw new Error(`Phase "${status}" failed: ${message}`);
    }

    await releaseBlogJobLease(jobId, companyId);
    const updated = await getBlogJob(jobId, companyId);
    if (!updated) throw error;
    return { job: jobToView(updated), advanced: false };
  }
}

/** Thin wrapper so `/api/blog/job` can keep advancing one phase per poll. */
export async function finishBlogGeneration(
  companyId: string,
  jobId: string
): Promise<BlogJobView> {
  const result = await advanceBlogJob(companyId, jobId);
  if (result.job.status === 'error') {
    throw new Error(result.job.errorMessage || 'Blog generation failed');
  }
  return result.job;
}

export async function getBlogJobView(jobId: string, companyId: string): Promise<BlogJobView | null> {
  const job = await getBlogJob(jobId, companyId);
  return job ? jobToView(job) : null;
}
