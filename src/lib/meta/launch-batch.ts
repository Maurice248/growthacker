import { DEFAULT_BRAND_NAME, DEFAULT_WEBSITE_URL } from '@/lib/legacy-brand';
import type { MetaCredentials } from '@/lib/meta-credentials';
import { metaAdSetDestinationType, metaMessagingCta, messagingOptimizationGoal } from '@/lib/meta/destination';

type LaunchSchema = {
  campaign?: Record<string, unknown>;
  ad_set?: Record<string, unknown>;
  ad?: Record<string, unknown>;
  link_data?: string;
};

type LaunchAdInput = {
  link_data: string;
  ad: Record<string, unknown>;
};

async function fetchMetaJson(res: Response) {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Meta API returned non-JSON. Status: ${res.status}. Body: ${text.slice(0, 200)}...`);
  }
  const body = parsed as { error?: { message?: string } };
  if (body?.error?.message) throw new Error(body.error.message);
  if (!res.ok) throw new Error(body.error?.message || `Meta API error ${res.status}`);
  return parsed as Record<string, unknown>;
}

async function uploadMedia(
  link_data: string,
  isVideo: boolean,
  accessToken: string,
  adAccountId: string
) {
  if (isVideo) {
    const uploadForm = new FormData();
    uploadForm.append('file_url', link_data);
    uploadForm.append('access_token', accessToken);
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}/advideos`, {
      method: 'POST',
      body: uploadForm,
    });
    const uploadData = await fetchMetaJson(uploadRes);
    const videoId = uploadData.id as string;
    if (!videoId) throw new Error('Failed to upload video');

    let imageHash: string | null = null;
    const picRes = await fetch(
      `https://graph.facebook.com/v21.0/${videoId}?fields=picture&access_token=${accessToken}`
    );
    const picData = (await picRes.json()) as { picture?: string };
    if (picData.picture) {
      const imgRes = await fetch(picData.picture);
      if (imgRes.ok) {
        const imgBlob = new Blob([await imgRes.arrayBuffer()], { type: 'image/jpeg' });
        const thumbForm = new FormData();
        thumbForm.append('source', imgBlob, 'video_thumb.jpg');
        thumbForm.append('access_token', accessToken);
        const thumbUpload = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}/adimages`, {
          method: 'POST',
          body: thumbForm,
        });
        const thumbData = (await thumbUpload.json()) as {
          images?: Record<string, { hash?: string }>;
        };
        imageHash = thumbData.images?.['video_thumb.jpg']?.hash || null;
      }
    }
    if (!imageHash) throw new Error('Could not generate video thumbnail');
    return { video_id: videoId, image_hash: imageHash };
  }

  const mediaRes = await fetch(link_data);
  if (!mediaRes.ok) throw new Error(`Failed to fetch image: ${link_data}`);
  const imgBlob = new Blob([await mediaRes.arrayBuffer()]);
  const uploadForm = new FormData();
  uploadForm.append('source', imgBlob, 'ad_image.jpg');
  uploadForm.append('access_token', accessToken);
  const uploadRes = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}/adimages`, {
    method: 'POST',
    body: uploadForm,
  });
  const uploadData = await fetchMetaJson(uploadRes);
  const imageHash = (uploadData.images as Record<string, { hash?: string }>)?.['ad_image.jpg']?.hash;
  if (!imageHash) throw new Error('Failed to upload image');
  return { image_hash: imageHash };
}

async function fetchPageId(accessToken: string, configuredPageId?: string | null) {
  let pageId = configuredPageId?.trim();
  if (!pageId || pageId === 'me' || pageId.startsWith('YOUR_')) {
    const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await fetchMetaJson(pagesRes);
    const data = (pagesData.data as Array<{ id: string }>) || [];
    if (!data.length) throw new Error('No Facebook Pages found');
    pageId = data[0].id;
  }
  return pageId!;
}

async function createCampaign(
  existingCampaignId: string | null | undefined,
  adAccountId: string,
  accessToken: string,
  campaign: Record<string, unknown>
) {
  if (existingCampaignId) return existingCampaignId;
  const objective = (campaign.objective as string) || 'OUTCOME_TRAFFIC';
  const isCbo = Boolean(campaign.is_adset_budget_sharing_enabled);
  const budgetType = (campaign.budget_type as string) || 'DAILY';
  const res = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: campaign.name || `[AUTO] ${objective}_${Date.now()}`,
      objective,
      status: 'PAUSED',
      special_ad_categories: [],
      ...(isCbo
        ? budgetType === 'DAILY'
          ? { daily_budget: campaign.daily_budget || 5000 }
          : { lifetime_budget: campaign.lifetime_budget || 50000 }
        : { is_adset_budget_sharing_enabled: false }),
      access_token: accessToken,
    }),
  });
  const data = await fetchMetaJson(res);
  return data.id as string;
}

async function createAdSet(
  adAccountId: string,
  accessToken: string,
  campaignId: string,
  adSet: Record<string, unknown>,
  ad: Record<string, unknown> = {}
) {
  if (adSet.existing_id) return adSet.existing_id as string;

  const geo = (adSet.geo_locations as Record<string, unknown>) || {
    countries: ['US'],
    location_types: ['home', 'recent'],
  };

  const destinationType = (ad.destination_type as string) || 'WEBSITE';
  const messagingApps = (ad.messaging_apps as string[]) || [];
  const metaDest = metaAdSetDestinationType(destinationType, messagingApps);
  const optimizationGoal =
    destinationType === 'MESSAGING'
      ? messagingOptimizationGoal(adSet.optimization_goal as string)
      : (adSet.optimization_goal as string) || 'LINK_CLICKS';

  const res = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: adSet.name || 'Ad Set',
      campaign_id: campaignId,
      daily_budget: adSet.daily_budget || 100,
      start_time: adSet.start_time || new Date().toISOString(),
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: {
        geo_locations: geo,
        age_min: adSet.age_min || 18,
        age_max: adSet.age_max || 65,
        targeting_automation: { advantage_audience: 0 },
      },
      ...(metaDest ? { destination_type: metaDest } : {}),
      status: 'PAUSED',
      access_token: accessToken,
    }),
  });
  const data = await fetchMetaJson(res);
  return data.id as string;
}

async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  pageId: string,
  isVideo: boolean,
  mediaPayload: Record<string, unknown>,
  ad: Record<string, unknown>
) {
  const headline = (ad.headline as string) || '';
  const primaryText = (ad.primary_text as string) || '';
  const websiteUrl = (ad.website_url as string) || DEFAULT_WEBSITE_URL;
  const ctaType = (ad.call_to_action_type as string) || 'LEARN_MORE';
  const adName = (ad.name as string) || 'Ad';
  const destinationType = (ad.destination_type as string) || 'WEBSITE';
  const messagingApps = (ad.messaging_apps as string[]) || [];
  const whatsappNumber = (ad.whatsapp_number as string) || '';
  const isMessaging = destinationType === 'MESSAGING';
  const cta = isMessaging
    ? metaMessagingCta(messagingApps, whatsappNumber)
    : { type: ctaType, value: { link: websiteUrl } };
  const link = websiteUrl || `https://www.facebook.com/${pageId}`;

  const objectStorySpec = isVideo
    ? {
        page_id: pageId,
        video_data: {
          video_id: mediaPayload.video_id,
          image_hash: mediaPayload.image_hash,
          title: headline,
          message: primaryText,
          link_description: headline,
          call_to_action: cta,
        },
      }
    : {
        page_id: pageId,
        link_data: {
          image_hash: mediaPayload.image_hash,
          link,
          message: primaryText,
          name: headline,
          call_to_action: cta,
        },
      };

  const res = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Creative_${adName}`,
      object_story_spec: objectStorySpec,
      access_token: accessToken,
    }),
  });
  const data = await fetchMetaJson(res);
  return data.id as string;
}

async function createAd(
  adAccountId: string,
  accessToken: string,
  adSetId: string,
  creativeId: string,
  ad: Record<string, unknown>,
  status: 'ACTIVE' | 'PAUSED' = 'PAUSED'
) {
  const res = await fetch(`https://graph.facebook.com/v21.0/act_${adAccountId}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: (ad.name as string) || 'Ad',
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status,
      access_token: accessToken,
    }),
  });
  const data = await fetchMetaJson(res);
  return data.id as string;
}

export async function launchAdsBatch(
  meta: MetaCredentials,
  schema: LaunchSchema,
  ads: LaunchAdInput[],
  existingCampaignId?: string | null,
  opts?: { adStatus?: 'ACTIVE' | 'PAUSED' }
) {
  const adStatus = opts?.adStatus ?? 'PAUSED';
  const { accessToken, adAccountId, pageId } = meta;
  const page = await fetchPageId(accessToken, pageId);
  const campaignId = await createCampaign(
    existingCampaignId,
    adAccountId,
    accessToken,
    schema.campaign || {}
  );
  const adSetId = await createAdSet(adAccountId, accessToken, campaignId, schema.ad_set || {}, schema.ad || {});

  const adIds: string[] = [];
  for (const item of ads) {
    const isVideo =
      String(item.ad?.media_type || item.ad?.type || '').toLowerCase() === 'video';
    const mediaPayload = await uploadMedia(item.link_data, isVideo, accessToken, adAccountId);
    const creativeId = await createAdCreative(
      adAccountId,
      accessToken,
      page,
      isVideo,
      mediaPayload,
      item.ad
    );
    const adId = await createAd(adAccountId, accessToken, adSetId, creativeId, item.ad, adStatus);
    adIds.push(adId);
  }

  return { campaignId, adSetId, adIds };
}

export function buildLaunchAdsFromVariants(
  schema: LaunchSchema,
  variants: Array<{
    mediaUrl: string;
    format: string;
    concept: Record<string, unknown>;
  }>
): LaunchAdInput[] {
  return variants.map((variant, index) => {
    const concept = variant.concept || {};
    const metadata =
      (concept.metadata as Record<string, unknown>) ||
      (concept as Record<string, unknown>);
    const isVideo = variant.format === 'Video';
    return {
      link_data: variant.mediaUrl,
      ad: {
        ...(schema.ad || {}),
        id: Date.now() + index,
        name:
          (metadata.ad_name as string) ||
          (concept.headline as string) ||
          `Variant ${index + 1}`,
        media_type: isVideo ? 'video' : 'image',
        type: isVideo ? 'video' : 'image',
        headline: (metadata.headline as string) || (concept.headline as string) || '',
        primary_text:
          (metadata.primary_text as string) || (concept.primary_text as string) || '',
        description: (metadata.ad_description as string) || '',
        website_url: (metadata.destination_url as string) || DEFAULT_WEBSITE_URL,
        call_to_action_type: (schema.ad?.call_to_action_type as string) || 'LEARN_MORE',
        facebook_page: (schema.ad?.facebook_page as string) || DEFAULT_BRAND_NAME,
      },
    };
  });
}
