import type { Prisma } from '@prisma/client';
import { chatCompletionJson, chatCompletionText } from '@/lib/social-studio/openai';
import { kieCreateImageTask, kieRecordInfo } from '@/lib/social-studio/kie';
import {
  createWordPressPost,
  fetchImageBytes,
  listWordPressCategories,
  updateWordPressPost,
  updateWordPressMediaMeta,
  uploadWordPressMedia,
} from '@/lib/wordpress';
import { ensureBlogConfig, getBlogConfig, resolveBlogContext } from './company-context';
import { getBlogCategoryById } from './categories';
import { researchKeywordsForSeeds } from './dataforseo';
import {
  cleanupArticleHtml,
  insertImageAfterFirstHeading,
  markdownToHtml,
  postProcessArticleMarkdown,
  prepareOutlineForArticle,
} from './html';
import { createBlogJob, getBlogJob, jobToView, updateBlogJob } from './jobs';
import { normalizeBlogOutline, normalizeBlogOutlineWithFallback, BLOG_OUTLINE_JSON_SCHEMA, BLOG_ARTICLE_JSON_SCHEMA } from './outline';
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
  BlogJobView,
  BlogOutline,
  BlogTokens,
} from './types';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function generateOutline(
  companyId: string,
  tokens: BlogTokens,
  category: BlogCategoryData,
  rankedKeywords: string[]
): Promise<BlogOutline> {
  const ctx = await resolveBlogContext(companyId);
  const config = await ensureBlogConfig(companyId);
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI');
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
  const maxAttempts = 3;
  let lastRaw: Record<string, unknown> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryNote =
      attempt > 1
        ? '\n\nRETRY REQUIRED: Your previous JSON was missing the required body_sections array. Return valid JSON with 3-5 objects in body_sections. Each object must include h2, description, keywords, and subsections.'
        : '';

    const parsed = await chatCompletionJson(
      openaiKey,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${userPrompt}${retryNote}` },
      ],
      { model: ctx.openAiModel, jsonMode: true, timeoutMs: 300_000 }
    );
    lastRaw = parsed;

    try {
      return normalizeBlogOutline(parsed);
    } catch (error) {
      const missingSections =
        error instanceof Error && error.message === 'OUTLINE_MISSING_BODY_SECTIONS';
      if (!missingSections || attempt === maxAttempts) break;
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
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI');
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
    openaiKey,
    [
      { role: 'system', content: `${articlePrompts.system}\n\n${BLOG_ARTICLE_JSON_SCHEMA}` },
      { role: 'user', content: userPrompt },
    ],
    { model: ctx.openAiModel, jsonMode: true, timeoutMs: 600_000 }
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

async function articleToHtml(article: BlogArticle, outline: BlogOutline): Promise<string> {
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
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI');
  const imagePrompts = getImagePrompts(ctx, config.imagePromptSystem);

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: imagePrompts.system },
      { role: 'user', content: buildDefaultImageUserPrompt(articleHtml) },
    ],
    { model: ctx.openAiModel, jsonMode: true, timeoutMs: 180_000 }
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
    const openaiKey = requireToken(tokens, 'openai', 'OpenAI');
    const parsed = await chatCompletionJson(
      openaiKey,
      [
        {
          role: 'system',
          content: 'Return JSON with category_id as a number for the best matching WordPress category.',
        },
        { role: 'user', content: buildWpCategoryPrompt(articleText, categories) },
      ],
      { model: ctx.openAiModel, jsonMode: true, timeoutMs: 60_000 }
    );

    const id = Number(parsed.category_id);
    if (!Number.isFinite(id) || id <= 0) return undefined;
    return id;
  } catch {
    return undefined;
  }
}

export async function startBlogGeneration(
  companyId: string,
  options: { categoryId: string }
): Promise<{ jobId: string; taskId: string }> {
  const tokens = await getBlogTokens(companyId);
  requireToken(tokens, 'openai', 'OpenAI');
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
  });

  try {
    await updateBlogJob(job.id, companyId, { status: 'keywords' });

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
      console.warn(
        '[blog/generate] DataForSEO unavailable, using category keywords:',
        message
      );
      rankedKeywordStrings = [...new Set(seeds)];
    }

    await updateBlogJob(job.id, companyId, { status: 'writing' });
    const outline = await generateOutline(companyId, tokens, category, rankedKeywordStrings);
    const article = await generateArticle(companyId, tokens, outline);
    const articleHtml = await articleToHtml(article, outline);

    await updateBlogJob(job.id, companyId, {
      title: article.title,
      slug: article.url,
      articleHtml,
      input: { outline, rankedKeywords: rankedKeywordStrings } as Prisma.InputJsonValue,
    });

    await updateBlogJob(job.id, companyId, { status: 'image' });
    const imageMeta = await generateImageMeta(companyId, tokens, articleHtml);
    const kieKey = requireToken(tokens, 'kie', 'KIE');
    const taskId = await kieCreateImageTask(kieKey, imageMeta.image_prompt, ctx.imageSize);

    await updateBlogJob(job.id, companyId, {
      imagePrompt: imageMeta.image_prompt,
      imageTaskId: taskId,
      input: { outline, imageMeta, rankedKeywords: rankedKeywordStrings } as Prisma.InputJsonValue,
    });

    return { jobId: job.id, taskId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Blog generation failed';
    await updateBlogJob(job.id, companyId, { status: 'error', errorMessage: message });
    throw error;
  }
}

export async function finishBlogGeneration(
  companyId: string,
  jobId: string
): Promise<BlogJobView> {
  const tokens = await getBlogTokens(companyId);
  const job = await getBlogJob(jobId, companyId);
  if (!job) throw new Error('Job not found');

  if (job.status === 'done') return jobToView(job);
  if (job.status === 'error') {
    throw new Error(job.errorMessage || 'Blog generation failed');
  }

  if (!job.imageTaskId || !job.articleHtml || !job.title || !job.slug) {
    throw new Error('Job is missing required data');
  }

  const kieKey = requireToken(tokens, 'kie', 'KIE');
  const wpConfig = await getBlogWordPressConfig(companyId);
  if (!wpConfig) throw new Error('WordPress is not configured');

  const ctx = await resolveBlogContext(companyId);
  const config = await getBlogConfig(companyId);
  const result = await kieRecordInfo(kieKey, job.imageTaskId);

  if (result.state !== 'success') {
    if (result.state === 'fail' || result.state === 'failed') {
      await updateBlogJob(jobId, companyId, {
        status: 'error',
        errorMessage: result.failMsg || 'Image generation failed',
      });
      throw new Error(result.failMsg || 'Image generation failed');
    }
    return jobToView({ ...job, status: 'image' });
  }

  const imageUrl = result.resultUrl;
  if (!imageUrl) throw new Error('Image generation succeeded but no URL returned');

  await updateBlogJob(jobId, companyId, { imageUrl, status: 'publishing' });

  const input = (job.input as Record<string, unknown>) || {};
  const imageMeta = (input.imageMeta as BlogImageMeta) || {
    alt_text: job.title,
    title: job.title,
    caption: '',
    description: '',
    image_prompt: job.imagePrompt || '',
  };

  let contentWithImage = insertImageAfterFirstHeading(
    job.articleHtml,
    imageUrl,
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
    const { bytes, mimeType } = await fetchImageBytes(imageUrl);
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

  await updateBlogJob(jobId, companyId, {
    status: 'done',
    wordpressPostId: post.id,
    wordpressPostUrl: postLink,
    articleHtml: contentWithImage,
  });

  const updated = await getBlogJob(jobId, companyId);
  return jobToView(updated!);
}

export async function getBlogJobView(jobId: string, companyId: string): Promise<BlogJobView | null> {
  const job = await getBlogJob(jobId, companyId);
  return job ? jobToView(job) : null;
}

export async function runFullBlogGeneration(
  companyId: string,
  categoryId: string,
  maxPollAttempts = 30,
  pollIntervalMs = 5000
): Promise<BlogJobView> {
  const { jobId } = await startBlogGeneration(companyId, { categoryId });

  for (let i = 0; i < maxPollAttempts; i++) {
    const job = await getBlogJob(jobId, companyId);
    if (!job) throw new Error('Job not found');

    if (job.status === 'done') return jobToView(job);
    if (job.status === 'error') throw new Error(job.errorMessage || 'Blog generation failed');

    if (job.status === 'image' && job.imageTaskId) {
      const view = await finishBlogGeneration(companyId, jobId);
      if (view.status === 'done') return view;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error('Blog generation timed out waiting for image');
}
