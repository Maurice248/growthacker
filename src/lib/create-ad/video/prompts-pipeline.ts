import { generateVoiceoverScript } from './script';
import { resolveAudioForItem } from './audio';
import { transcribeAndSegment } from './transcribe';
import { generateVisualPrompts } from './visual-prompts';
import type { AdItemInput, CreateAdTokens, VideoScene } from '../types';

export type VideoPromptsResult = {
  itemIndex: number;
  itemId: number;
  scenes: VideoScene[];
  audioKey: string;
  audioUrl: string;
};

export async function runVideoPromptsForItem(
  companyId: string,
  tokens: CreateAdTokens,
  item: AdItemInput,
  itemIndex: number
): Promise<VideoPromptsResult> {
  const { script } = await generateVoiceoverScript(companyId, tokens, item);
  const { audioUrl, audioKey } = await resolveAudioForItem(tokens, {
    voiceId: item.voiceId,
    audioStyle: item.audioStyle,
    script,
  });

  const transcript = await transcribeAndSegment(tokens, audioUrl);
  const scenes = await generateVisualPrompts(companyId, tokens, item, transcript.text);

  return {
    itemIndex,
    itemId: item.id,
    scenes,
    audioKey,
    audioUrl,
  };
}

export async function runVideoPromptsPipeline(
  companyId: string,
  tokens: CreateAdTokens,
  items: AdItemInput[]
): Promise<VideoPromptsResult[]> {
  const videoItems = items.filter((i) => i.type === 'video' && i.idea?.trim());
  const results: VideoPromptsResult[] = [];

  for (let i = 0; i < videoItems.length; i++) {
    const result = await runVideoPromptsForItem(companyId, tokens, videoItems[i], i);
    results.push(result);
  }

  return results;
}
