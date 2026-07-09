import { resolveSocialContext } from './config';
import { createSocialJob, updateSocialJob } from './jobs';
import { kieCreateImageTask, kiePollTasks } from './kie';
import { chatCompletionJson, chatCompletionText } from './openai';
import { formatPlatformDescriptions } from './platform-format';
import {
  buildImagePromptSystem,
  buildImagePromptUser,
  buildImageSocialCopySystem,
  buildImageSocialCopyUser,
} from './prompts';
import { postImageToPlatforms } from './upload-post';
import { requireToken } from './tokens';
import type { PlatformDescriptions, SocialMetadata, SocialStudioTokens } from './types';

function sanitizeImagePrompt(raw: string): string {
  return raw
    .replace(/```/g, '')
    .replace(/"/g, '')
    .replace(/\n/g, ' ')
    .trim();
}

export async function generateImagePrompt(
  companyId: string,
  tokens: SocialStudioTokens,
  topic: string
): Promise<string> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveSocialContext(companyId);

  const raw = await chatCompletionText(
    openaiKey,
    [
      { role: 'system', content: buildImagePromptSystem(ctx) },
      { role: 'user', content: buildImagePromptUser(topic, ctx) },
    ],
    { model: 'o3-mini', jsonMode: false, timeoutMs: 300_000 }
  );

  return sanitizeImagePrompt(raw);
}

export async function generateImageSocialCopy(
  companyId: string,
  tokens: SocialStudioTokens,
  topic: string
): Promise<SocialMetadata> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveSocialContext(companyId);

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: buildImageSocialCopySystem(ctx) },
      { role: 'user', content: buildImageSocialCopyUser(topic, ctx) },
    ],
    { model: 'gpt-4.1-mini', jsonMode: true, timeoutMs: 300_000 }
  );

  return {
    video_title: String(parsed.video_title || ''),
    post: String(parsed.post || ''),
    tags: String(parsed.tags || ''),
    caption: String(parsed.caption || ''),
  };
}

export async function startImageGeneration(
  companyId: string,
  tokens: SocialStudioTokens,
  topic: string,
  ratio?: string
): Promise<{ jobId: string; taskId: string; imagePrompt: string }> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  const ctx = await resolveSocialContext(companyId);

  const job = await createSocialJob(companyId, 'image', { topic, ratio }, 'Image creation started');

  const imagePrompt = await generateImagePrompt(companyId, tokens, topic);
  const taskId = await kieCreateImageTask(kieKey, imagePrompt, ratio || ctx.defaultImageRatio || '1:1');

  await updateSocialJob(job.id, companyId, {
    status: 'Generating image...',
    input: { topic, ratio, imagePrompt, taskId },
  });

  return { jobId: job.id, taskId, imagePrompt };
}

export async function pollImageTask(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  taskId: string,
  topic: string
): Promise<{ state: string; imageUrl?: string; descriptions?: PlatformDescriptions; platforms?: Record<string, unknown> }> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  const [result] = await kiePollTasks(kieKey, [taskId]);

  if (result.state !== 'success') {
    if (result.state === 'fail' || result.state === 'failed') {
      await updateSocialJob(jobId, companyId, { status: 'Image generation failed', error: result.failMsg });
      throw new Error(result.failMsg || 'Image generation failed');
    }
    return { state: result.state };
  }

  const imageUrl = result.resultUrl;
  if (!imageUrl) throw new Error('Image generation succeeded but no URL returned');

  const meta = await generateImageSocialCopy(companyId, tokens, topic);
  const formatted = formatPlatformDescriptions(meta, imageUrl);

  await updateSocialJob(jobId, companyId, {
    status: 'Image ready for review',
    assetUrl: imageUrl,
    descriptions: formatted.descriptions,
    input: { topic, taskId, imagePrompt: result.prompt },
  });

  return {
    state: 'success',
    imageUrl,
    descriptions: formatted.descriptions,
    platforms: formatted.platforms,
  };
}

export async function postImage(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  imageUrl: string,
  descriptions: PlatformDescriptions
): Promise<{ results: unknown[] }> {
  const ctx = await resolveSocialContext(companyId);
  const result = await postImageToPlatforms(tokens, ctx, imageUrl, descriptions);
  await updateSocialJob(jobId, companyId, { status: 'Image Posted' });
  return result;
}
