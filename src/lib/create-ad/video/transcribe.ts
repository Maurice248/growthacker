import { requireToken } from '../tokens';
import type { CreateAdTokens } from '../types';

const CLIP_DURATION_MS = 3900;

type Word = { text: string; start: number; end: number };

export type TranscriptSegment = {
  type: 'SEGMENT';
  segmentNumber: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  wordCount: number;
  text: string;
  words: Word[];
};

export async function submitTranscription(
  tokens: CreateAdTokens,
  audioUrl: string
): Promise<string> {
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
  tokens: CreateAdTokens,
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

    if (!res.ok) {
      throw new Error(`AssemblyAI poll HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      status?: string;
      words?: Word[];
      error?: string;
    };

    if (data.status === 'completed') {
      return data.words || [];
    }
    if (data.status === 'error') {
      throw new Error(data.error || 'AssemblyAI transcription failed');
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('AssemblyAI transcription timed out');
}

export function segmentTranscript(words: Word[]): {
  segments: TranscriptSegment[];
  fullScript: string;
  totalDurationSeconds: number;
} {
  if (!words.length) {
    return { segments: [], fullScript: '', totalDurationSeconds: 0 };
  }

  const totalAudioDuration = words[words.length - 1].end;
  const totalClips = Math.round(totalAudioDuration / CLIP_DURATION_MS);
  const segments: TranscriptSegment[] = [];

  for (let i = 0; i < totalClips; i++) {
    const clipStart = i * CLIP_DURATION_MS;
    const clipEnd = (i + 1) * CLIP_DURATION_MS;

    let clipWords = words.filter((w) => {
      const mid = (w.start + w.end) / 2;
      return mid >= clipStart && mid < clipEnd;
    });

    if (clipWords.length === 0 && i === totalClips - 1) {
      const usedEndTimes = segments.flatMap((s) => s.words.map((w) => w.end));
      clipWords = words.filter((w) => !usedEndTimes.includes(w.end));
    }

    if (clipWords.length === 0) continue;

    segments.push({
      type: 'SEGMENT',
      segmentNumber: i + 1,
      startTime: clipWords[0].start,
      endTime: clipWords[clipWords.length - 1].end,
      durationSeconds: parseFloat(
        ((clipWords[clipWords.length - 1].end - clipWords[0].start) / 1000).toFixed(2)
      ),
      wordCount: clipWords.length,
      text: clipWords.map((w) => w.text).join(' ').trim(),
      words: clipWords,
    });
  }

  return {
    segments,
    fullScript: words.map((w) => w.text).join(' ').trim(),
    totalDurationSeconds: parseFloat((totalAudioDuration / 1000).toFixed(2)),
  };
}

export async function transcribeAndSegment(
  tokens: CreateAdTokens,
  audioUrl: string
): Promise<{
  text: string[];
  segments: TranscriptSegment[];
  fullScript: string;
  totalDurationSeconds: number;
}> {
  const transcriptId = await submitTranscription(tokens, audioUrl);
  const words = await pollTranscription(tokens, transcriptId);
  const { segments, fullScript, totalDurationSeconds } = segmentTranscript(words);
  return {
    text: segments.map((s) => s.text),
    segments,
    fullScript,
    totalDurationSeconds,
  };
}
