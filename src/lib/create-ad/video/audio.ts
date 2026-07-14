import { uploadAudio } from '../supabase';
import { requireToken } from '../tokens';
import type { CreateAdTokens } from '../types';

const FALLBACK_BG_MUSIC =
  'https://coherent-rose-lecdwbodzs.edgeone.app/kontraa-attitude-hiphop-music-109789_lKRui2a6.mp3';

export async function generateElevenLabsAudio(
  tokens: CreateAdTokens,
  voiceId: string,
  script: string
): Promise<{ audioBuffer: Buffer; audioKey: string; publicUrl: string }> {
  const apiKey = requireToken(tokens, 'elevenLabs', 'ElevenLabs API key');

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_flash_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.5 },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  const uploaded = await uploadAudio(audioBuffer);
  return {
    audioBuffer,
    audioKey: uploaded.key,
    publicUrl: uploaded.publicUrl,
  };
}

export async function resolveAudioForItem(
  tokens: CreateAdTokens,
  item: { voiceId?: string; audioStyle?: string; script: string }
): Promise<{ audioUrl: string; audioKey: string }> {
  const voiceId = item.voiceId || 'rTOopItG6FIkKMIVxsl5';
  const result = await generateElevenLabsAudio(tokens, voiceId, item.script);
  return { audioUrl: result.publicUrl, audioKey: result.audioKey };
}
