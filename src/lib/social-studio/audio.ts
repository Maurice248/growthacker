import { requireToken } from './tokens';
import type { SocialStudioTokens } from './types';

export async function generateElevenLabsAudio(
  tokens: SocialStudioTokens,
  voiceId: string,
  script: string
): Promise<{ audioBuffer: Buffer; publicUrl: string }> {
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
    throw new Error(`ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());

  // Upload to a temporary public URL via Upload Post storage pattern — use data URL workaround
  // For AssemblyAI we need a public URL. Upload to Supabase if available, else use upload-post temp.
  const { uploadAudioToPublicUrl } = await import('./storage');
  const publicUrl = await uploadAudioToPublicUrl(audioBuffer);
  return { audioBuffer, publicUrl };
}
