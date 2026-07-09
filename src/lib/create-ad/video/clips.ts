import { kieCreateVideoTasks, kiePollTasks } from '../kie';
import { requireToken } from '../tokens';
import type { CreateAdTokens, KieTaskResult, VideoScene } from '../types';

export async function createSceneVideoTasks(
  tokens: CreateAdTokens,
  scenes: VideoScene[]
): Promise<Array<{ taskId: string; sceneIndex: number }>> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  const validScenes = scenes.filter((s) => s.image_url);
  return kieCreateVideoTasks(
    kieKey,
    validScenes.map((s) => ({
      video_scenario: s.video_scenario || '',
      image_url: s.image_url!,
    }))
  );
}

export function attachVideoUrlsToScenes(
  scenes: VideoScene[],
  taskIds: Array<{ taskId: string; sceneIndex: number }>,
  pollResults: KieTaskResult[]
): VideoScene[] {
  const resultMap: Record<string, KieTaskResult> = {};
  for (const r of pollResults) {
    if (r.taskId) resultMap[r.taskId] = r;
  }

  const scenesWithImages = scenes.filter((s) => s.image_url);
  return scenes.map((scene) => {
    const imgIndex = scenesWithImages.findIndex(
      (s) => s.scene === scene.scene && s.prompt === scene.prompt
    );
    if (imgIndex < 0) return scene;

    const task = taskIds[imgIndex];
    const result = task ? resultMap[task.taskId] : null;
    return {
      ...scene,
      video_url: result?.state === 'success' ? result.resultUrl || '' : '',
      task_id: task?.taskId || scene.task_id,
    };
  });
}

export async function pollSceneVideos(
  tokens: CreateAdTokens,
  taskIds: string[]
): Promise<KieTaskResult[]> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  return kiePollTasks(kieKey, taskIds);
}
