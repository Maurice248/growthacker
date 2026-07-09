import { kieCreateImageTasks, kiePollTasks } from '../kie';
import { requireToken } from '../tokens';
import type { CreateAdTokens, KieTaskResult, VideoScene } from '../types';

export async function createSceneImageTasks(
  tokens: CreateAdTokens,
  scenes: VideoScene[]
): Promise<Array<{ taskId: string; sceneIndex: number; prompt: string }>> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');

  const prompts = scenes.map((s) => ({
    prompt: s.prompt_clean || s.prompt,
    image_size: '9:16' as const,
    image_urls: s.character_image ? [s.character_image] : undefined,
  }));

  const tasks = await kieCreateImageTasks(kieKey, prompts);
  return tasks.map((t, i) => ({
    taskId: t.taskId,
    sceneIndex: i,
    prompt: t.prompt,
  }));
}

export function matchImageResultsToScenes(
  scenes: VideoScene[],
  pollResults: KieTaskResult[],
  taskPrompts: string[]
): VideoScene[] {
  return scenes.map((scene, i) => {
    const scenePrompt = (scene.prompt_clean || scene.prompt || '').trim().toLowerCase();
    let best: KieTaskResult | null = null;
    let bestScore = 0;

    for (const result of pollResults) {
      if (result.state !== 'success' || !result.resultUrl) continue;
      const imgPrompt = (result.prompt || taskPrompts[i] || '').trim().toLowerCase();
      const sceneWords = new Set(scenePrompt.split(/\s+/).slice(0, 30));
      const imgWords = imgPrompt.split(/\s+/).slice(0, 30);
      const score = imgWords.filter((w) => sceneWords.has(w)).length;
      if (score > bestScore) {
        bestScore = score;
        best = result;
      }
    }

    if (!best && pollResults[i]?.state === 'success') {
      best = pollResults[i];
    }

    return {
      ...scene,
      image_url: best?.resultUrl || '',
      task_id: best?.taskId || '',
    };
  });
}

export async function pollSceneImages(
  tokens: CreateAdTokens,
  taskIds: string[]
): Promise<KieTaskResult[]> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  return kiePollTasks(kieKey, taskIds);
}
