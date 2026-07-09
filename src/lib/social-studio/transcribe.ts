import { requireToken } from './tokens';
import type { SocialStudioTokens } from './types';

const CLIP_DURATION_MS = 3900;

type Word = { text: string; start: number; end: number };

export async function submitTranscription(tokens: SocialStudioTokens, audioUrl: string): Promise<string> {
  const apiKey = requireToken(tokens, 'assemblyai', 'AssemblyAI API token');

  const res = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ audio_url: audioUrl }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`AssemblyAI submit HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('AssemblyAI missing transcript id');
  return data.id;
}

export async function pollTranscription(
  tokens: SocialStudioTokens,
  transcriptId: string,
  maxAttempts = 30,
  intervalMs = 5000
): Promise<Word[]> {
  const apiKey = requireToken(tokens, 'assemblyai', 'AssemblyAI API token');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`AssemblyAI poll HTTP ${res.status}`);

    const data = (await res.json()) as { status?: string; words?: Word[]; error?: string };

    if (data.status === 'completed') return data.words || [];
    if (data.status === 'error') throw new Error(data.error || 'AssemblyAI transcription failed');

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('AssemblyAI transcription timed out');
}

function segmentTranscript(words: Word[]): string[] {
  if (!words.length) return [];

  const totalAudioDuration = words[words.length - 1].end;
  const totalClips = Math.max(1, Math.round(totalAudioDuration / CLIP_DURATION_MS));
  const segments: string[] = [];

  for (let i = 0; i < totalClips; i++) {
    const clipStart = i * CLIP_DURATION_MS;
    const clipEnd = (i + 1) * CLIP_DURATION_MS;

    const clipWords = words.filter((w) => {
      const mid = (w.start + w.end) / 2;
      return mid >= clipStart && mid < clipEnd;
    });

    if (clipWords.length > 0) {
      segments.push(clipWords.map((w) => w.text).join(' ').trim());
    }
  }

  return segments.length ? segments : [words.map((w) => w.text).join(' ').trim()];
}

export async function transcribeAndSegment(
  tokens: SocialStudioTokens,
  audioUrl: string
): Promise<{ text: string[]; fullScript: string }> {
  const transcriptId = await submitTranscription(tokens, audioUrl);
  const words = await pollTranscription(tokens, transcriptId);
  const text = segmentTranscript(words);
  return {
    text,
    fullScript: words.map((w) => w.text).join(' ').trim(),
  };
}
