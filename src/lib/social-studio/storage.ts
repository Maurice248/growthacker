import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { publicStorageUrl } from '@/lib/create-ad/supabase';

const SOCIAL_VIDEO_BUCKET = process.env.SOCIAL_STUDIO_VIDEO_BUCKET || 'AD1';

function getStorageClient() {
  try {
    return getSupabaseAdmin();
  } catch {
    return null;
  }
}

export async function uploadAudioToPublicUrl(audioBuffer: Buffer): Promise<string> {
  const client = getStorageClient();
  if (!client) {
    throw new Error('Supabase storage is not configured for audio upload.');
  }

  const key = `social-studio/audio-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
  const { error } = await client.storage.from('audio').upload(key, audioBuffer, {
    contentType: 'audio/mpeg',
    upsert: true,
  });

  if (error) throw new Error(`Audio upload failed: ${error.message}`);

  return publicStorageUrl('audio', key);
}

export async function uploadVideoToPublicUrl(videoBuffer: Buffer, companyId: string): Promise<string> {
  const client = getStorageClient();
  if (!client) {
    throw new Error('Supabase storage is not configured for video upload.');
  }

  const key = `social-studio/${companyId}/video-${Date.now()}.mp4`;
  const { error } = await client.storage.from(SOCIAL_VIDEO_BUCKET).upload(key, videoBuffer, {
    contentType: 'video/mp4',
    upsert: true,
  });

  if (error) throw new Error(`Video upload failed: ${error.message}`);

  return publicStorageUrl(SOCIAL_VIDEO_BUCKET, key);
}
