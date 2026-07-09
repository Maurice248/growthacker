import { requireToken } from './tokens';
import type { PlatformDescriptions, SocialPlatform, SocialStudioContext, SocialStudioTokens } from './types';

function formatUploadPostAuth(token: string): string {
  const trimmed = token.trim();
  if (/^Apikey\s+/i.test(trimmed)) return trimmed.replace(/^ApiKey\s+/i, 'Apikey ');
  if (/^Bearer\s+/i.test(trimmed)) return `Apikey ${trimmed.replace(/^Bearer\s+/i, '')}`;
  return `Apikey ${trimmed}`;
}

async function fetchMediaBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Failed to fetch media: HTTP ${res.status}`);
  return res.blob();
}

export async function postImageToPlatforms(
  tokens: SocialStudioTokens,
  ctx: SocialStudioContext,
  imageUrl: string,
  descriptions: PlatformDescriptions
): Promise<{ results: unknown[] }> {
  const apiKey = requireToken(tokens, 'uploadPost', 'Upload Post API token');
  if (!ctx.uploadPostUser) {
    throw new Error('Upload Post user is not configured. Set it in Social Overview settings.');
  }

  const platforms = ctx.enabledPlatforms.filter((p) => p !== 'youtube');
  if (!platforms.length) {
    throw new Error('No platforms enabled for posting. Configure platforms in Social Overview.');
  }

  const blob = await fetchMediaBlob(imageUrl);
  const results: unknown[] = [];

  for (const platform of platforms) {
    const form = new FormData();
    form.append('user', ctx.uploadPostUser);
    form.append('platform[]', platform);
    form.append('photos[]', blob, 'social-image.png');

    const title =
      platform === 'facebook'
        ? descriptions.facebook
        : platform === 'instagram'
          ? descriptions.instagram
          : platform === 'linkedin'
            ? descriptions.linkedin
            : platform === 'tiktok'
              ? descriptions.tiktok.split('\n')[0]
              : descriptions.twitter;

    form.append('title', title);
    if (platform === 'facebook') {
      form.append('description', descriptions.facebook);
      if (ctx.facebookPageId) form.append('facebook_page_id', ctx.facebookPageId);
    }
    if (platform === 'linkedin' && ctx.linkedinOrgUrn) {
      form.append('target_linkedin_page_id', ctx.linkedinOrgUrn);
      form.append('description', descriptions.linkedin);
    }
    if (platform === 'tiktok') {
      form.append('description', descriptions.tiktok);
      if (ctx.tiktokHandle) form.append('tiktok_title', descriptions.tiktok.split('\n')[0]);
    }

    const res = await fetch('https://api.upload-post.com/api/upload_photos', {
      method: 'POST',
      headers: { Authorization: formatUploadPostAuth(apiKey) },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      throw new Error(`Upload Post (${platform}) HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    results.push({ platform, data });
  }

  return { results };
}

export async function postVideoToPlatforms(
  tokens: SocialStudioTokens,
  ctx: SocialStudioContext,
  videoUrl: string,
  descriptions: PlatformDescriptions,
  title: string
): Promise<{ results: unknown[] }> {
  const apiKey = requireToken(tokens, 'uploadPost', 'Upload Post API token');
  if (!ctx.uploadPostUser) {
    throw new Error('Upload Post user is not configured. Set it in Social Overview settings.');
  }

  const platforms = ctx.enabledPlatforms;
  if (!platforms.length) {
    throw new Error('No platforms enabled for posting.');
  }

  const blob = await fetchMediaBlob(videoUrl);
  const results: unknown[] = [];

  for (const platform of platforms) {
    const form = new FormData();
    form.append('user', ctx.uploadPostUser);
    form.append('platform[]', platform);
    form.append('video', blob, 'social-video.mp4');
    form.append('title', title);

    if (platform === 'facebook') {
      form.append('description', descriptions.facebook);
      if (ctx.facebookPageId) form.append('facebook_page_id', ctx.facebookPageId);
    }
    if (platform === 'linkedin' && ctx.linkedinOrgUrn) {
      form.append('target_linkedin_page_id', ctx.linkedinOrgUrn);
      form.append('description', descriptions.linkedin);
    }
    if (platform === 'tiktok') form.append('description', descriptions.tiktok);
    if (platform === 'youtube') form.append('description', descriptions.youtube || descriptions.facebook);

    const res = await fetch('https://api.upload-post.com/api/upload', {
      method: 'POST',
      headers: { Authorization: formatUploadPostAuth(apiKey) },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      throw new Error(`Upload Post video (${platform}) HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    results.push({ platform, data });
  }

  return { results };
}

export { formatUploadPostAuth };
