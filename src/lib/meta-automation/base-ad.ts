import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { BaseAdConcept } from './types';

function parseJsonField(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function fetchBaseAdConcept(
  companyId: string,
  opts: { baseAdId?: string | number; baseAdText?: string }
): Promise<BaseAdConcept> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('your_name_table')
    .select('id, text, format, story, "json data", company_id')
    .eq('company_id', companyId);

  if (opts.baseAdId) {
    query = query.eq('id', opts.baseAdId);
  } else if (opts.baseAdText) {
    query = query.eq('text', opts.baseAdText);
  } else {
    throw new Error('baseAdId or baseAdText is required');
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Base ad not found');

  const metadata = parseJsonField(data['json data']);
  const nestedAd =
    metadata.ad && typeof metadata.ad === 'object'
      ? (metadata.ad as Record<string, unknown>)
      : {};

  const format = (data.format === 'Image' ? 'Image' : 'Video') as 'Video' | 'Image';
  const idea =
    (metadata.idea as string) ||
    (nestedAd.idea as string) ||
    data.story ||
    (metadata.primary_text as string) ||
    (metadata.ad_name as string) ||
    '';

  return {
    mediaUrl: data.text,
    format,
    story: data.story,
    metadata,
    idea: String(idea),
    duration: (metadata.duration as string) || '25s',
    audioStyle: (metadata.audioStyle as string) || 'Warm & Conversational',
    videoStyle: (metadata.videoStyle as string) || 'Cinematic',
    imageStyle: (metadata.imageStyle as string) || 'Bold & Colorful',
    character: (metadata.character as string) || 'Female',
    voiceId: (metadata.voiceId as string) || '',
    language: (metadata.language as string) || 'English',
  };
}

export function conceptToMetadata(concept: BaseAdConcept | Record<string, unknown>) {
  const c = concept as BaseAdConcept;
  const meta = c.metadata || (concept as Record<string, unknown>);
  return {
    ad_name: (meta.ad_name as string) || (meta.headline as string) || 'Ad Variant',
    primary_text: (meta.primary_text as string) || '',
    headline: (meta.headline as string) || '',
    ad_description: (meta.ad_description as string) || '',
    destination_url: (meta.destination_url as string) || '',
    idea: c.idea || (meta.idea as string) || '',
  };
}
