import type { PlatformDescriptions, SocialMetadata } from './types';

function smartTruncate(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced) + '…';
}

function tagsToArray(tagStr: string): string[] {
  return tagStr
    .split(/\s+/)
    .filter((t) => t.startsWith('#'))
    .map((t) => t.trim());
}

function limitTags(tagStr: string, n: number): string {
  return tagsToArray(tagStr).slice(0, n).join(' ');
}

function fitTagsInLimit(baseText: string, tagStr: string, maxTotalChars: number): string {
  const allTags = tagsToArray(tagStr);
  let result = baseText;
  for (const tag of allTags) {
    const candidate = result ? `${result} ${tag}` : tag;
    if (candidate.length <= maxTotalChars) {
      result = candidate;
    } else {
      break;
    }
  }
  return result;
}

export function formatPlatformDescriptions(
  meta: SocialMetadata,
  imageUrl: string
): {
  platforms: Record<string, unknown>;
  descriptions: PlatformDescriptions;
  raw: SocialMetadata;
} {
  const videoTitle = (meta.video_title || '').trim();
  const postBody = (meta.post || '').trim();
  const tags = (meta.tags || '').trim();
  const caption = (meta.caption || '').trim();

  const facebookContent = [videoTitle, '', postBody, '', limitTags(tags, 5)].join('\n').trim();
  const instagramContent = [videoTitle, '', postBody, '', '.', '.', '.', limitTags(tags, 5)]
    .join('\n')
    .trim();
  const linkedinContent = [videoTitle, '', postBody, '', limitTags(tags, 7)].join('\n').trim();

  const TIKTOK_MAX = 85;
  const tiktokTitleSafe = smartTruncate(videoTitle, TIKTOK_MAX);
  const tiktokCaption = fitTagsInLimit(tiktokTitleSafe, tags, TIKTOK_MAX);

  const TWITTER_MAX = 150;
  const twitterTitleSafe = smartTruncate(videoTitle, TWITTER_MAX);
  const twitterContent = fitTagsInLimit(twitterTitleSafe, tags, TWITTER_MAX);

  const youtubeTitle = smartTruncate(videoTitle, 100);
  const youtubeDescription = [postBody, '', tags].join('\n').trim();

  const platforms = {
    facebook: {
      title: videoTitle,
      content: facebookContent,
      char_count: facebookContent.length,
      image_url: imageUrl,
    },
    instagram: {
      title: videoTitle,
      content: instagramContent,
      char_count: instagramContent.length,
      image_url: imageUrl,
    },
    linkedin: {
      title: videoTitle,
      content: linkedinContent,
      char_count: linkedinContent.length,
      image_url: imageUrl,
    },
    tiktok: {
      title: '',
      caption: tiktokCaption,
      description: '',
      char_count: tiktokCaption.length,
      image_url: imageUrl,
    },
    youtube: {
      title: youtubeTitle,
      description: youtubeDescription,
      char_count: youtubeDescription.length,
      image_url: imageUrl,
    },
    twitter: {
      content: twitterContent,
      char_count: twitterContent.length,
      image_url: imageUrl,
    },
  };

  const descriptions: PlatformDescriptions = {
    facebook: facebookContent,
    instagram: instagramContent,
    linkedin: linkedinContent,
    tiktok: tiktokCaption,
    twitter: twitterContent,
    youtube: youtubeDescription,
  };

  return { platforms, descriptions, raw: { video_title: videoTitle, post: postBody, tags, caption } };
}
