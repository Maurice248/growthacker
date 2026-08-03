import { chatCompletionJson } from '../openai';
import {
  buildVisualPromptsSystemPrompt,
  buildVisualPromptsUserPrompt,
} from '../prompts';
import { getCharacterImage, resolveCreateAdCompanyContext } from '../company-context';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import type { AdItemInput, CreateAdTokens, VideoScene } from '../types';

function getPhase(index: number, total: number, agentPhase?: number): number {
  if (agentPhase === 1 || agentPhase === 2 || agentPhase === 3) return agentPhase;
  if (total <= 5) {
    if (index < 2) return 1;
    if (index < 4) return 2;
    return 3;
  }
  if (index < Math.floor(total * 0.375)) return 1;
  if (index < Math.floor(total * 0.75)) return 2;
  return 3;
}

function sanitizePrompt(str: string): string {
  return (str || '')
    .replace(/"/g, "'")
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\\/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

const emotionVideo: Record<number, string> = {
  1: 'Character appears visibly sad and self-conscious throughout the entire clip, face showing emotional pain, never smiling, holding visible tension in jaw and brow. ',
  2: 'Character appears calm and quietly reassured throughout the clip, neutral to slightly hopeful, no joy yet, attentive and trusting. ',
  3: 'Character is visibly joyful and confident throughout the entire clip, smiling openly, relaxed and radiant. ',
};

export async function generateVisualPrompts(
  companyId: string,
  tokens: CreateAdTokens,
  item: AdItemInput,
  scriptLines: string[]
): Promise<VideoScene[]> {
  const ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  const ctx = await resolveCreateAdCompanyContext(companyId);
  const character = String(item.character || 'female').toLowerCase().trim();
  const characterImage = getCharacterImage(character);

  const parsed = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: buildVisualPromptsSystemPrompt(ctx) },
      { role: 'user', content: buildVisualPromptsUserPrompt(scriptLines, item) },
    ],
    { model: 'gpt-4o', jsonMode: true, timeoutMs: 300_000 }
  );

  const prompts = (parsed.visual_prompts as Array<Record<string, unknown>>) || [];
  const total = prompts.length;

  return prompts.map((p, index) => {
    const phase = getPhase(index, total, Number(p.phase));
    return {
      scene: Number(p.scene ?? index + 1),
      script_line: String(p.script_line || scriptLines[index] || ''),
      prompt: String(p.prompt || ''),
      prompt_clean: sanitizePrompt(String(p.prompt || '')),
      video_scenario: emotionVideo[phase] + String(p.video_scenario || ''),
      phase,
      emotion_type: phase === 1 ? 'sad' : phase === 2 ? 'neutral' : 'happy',
      character,
      character_image: characterImage,
    };
  });
}
