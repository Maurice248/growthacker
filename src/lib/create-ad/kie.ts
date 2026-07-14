import type { KieTaskResult } from './types';

const KIE_BASE = 'https://api.kie.ai/api/v1';

export type KieCreateTaskInput = {
  model: string;
  input: Record<string, unknown>;
};

export type KieRequestOptions = {
  timeoutMs?: number;
};

export async function kieCreateTask(
  apiKey: string,
  payload: KieCreateTaskInput,
  options: KieRequestOptions = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`kie.ai createTask HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: { data?: { taskId?: string }; taskId?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`kie.ai invalid response: ${text.slice(0, 200)}`);
  }

  const taskId = data.data?.taskId || data.taskId;
  if (!taskId) {
    throw new Error(`kie.ai missing taskId: ${text.slice(0, 200)}`);
  }

  return taskId;
}

export async function kieRecordInfo(
  apiKey: string,
  taskId: string,
  options: KieRequestOptions = {}
): Promise<KieTaskResult> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const url = new URL(`${KIE_BASE}/jobs/recordInfo`);
  url.searchParams.set('taskId', taskId);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`kie.ai recordInfo HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let parsed: { data?: Record<string, unknown> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`kie.ai invalid poll response: ${text.slice(0, 200)}`);
  }

  const data = parsed.data || {};
  const state = String(data.state || 'unknown');
  let resultUrl: string | null = null;

  try {
    const resultJson =
      typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
    resultUrl = resultJson?.resultUrls?.[0] || null;
  } catch {
    resultUrl = null;
  }

  let prompt: string | null = null;
  try {
    const param = typeof data.param === 'string' ? JSON.parse(data.param) : data.param;
    const input = typeof param?.input === 'string' ? JSON.parse(param.input) : param?.input;
    prompt = input?.prompt || null;
  } catch {
    prompt = null;
  }

  return {
    taskId,
    state,
    resultUrl,
    failMsg: (data.failMsg as string) || null,
    prompt,
  };
}

export async function kiePollTasks(
  apiKey: string,
  taskIds: string[],
  options: KieRequestOptions = {}
): Promise<KieTaskResult[]> {
  return Promise.all(taskIds.map((taskId) => kieRecordInfo(apiKey, taskId, options)));
}

export function kieAllComplete(results: KieTaskResult[]): boolean {
  return results.every(
    (r) => r.state === 'success' || r.state === 'fail' || r.state === 'failed'
  );
}

export async function kieCreateImageTasks(
  apiKey: string,
  prompts: Array<{ prompt: string; image_size?: string; image_urls?: string[] }>
): Promise<Array<{ taskId: string; prompt: string }>> {
  const tasks: Array<{ taskId: string; prompt: string }> = [];

  for (const item of prompts) {
    const input: Record<string, unknown> = {
      prompt: item.prompt,
      output_format: 'png',
      image_size: item.image_size || '4:5',
    };
    if (item.image_urls?.length) {
      input.image_urls = item.image_urls;
      input.prompt =
        item.prompt +
        ' The subject face and identity must match the reference image exactly. Facial expression is critical and must match the emotion described in the prompt precisely.';
    }

    const taskId = await kieCreateTask(apiKey, {
      model: 'google/nano-banana',
      input,
    });
    tasks.push({ taskId, prompt: item.prompt });
  }

  return tasks;
}

export async function kieCreateVideoTasks(
  apiKey: string,
  scenes: Array<{ video_scenario: string; image_url: string; videoStyle?: string }>
): Promise<Array<{ taskId: string; sceneIndex: number }>> {
  const tasks: Array<{ taskId: string; sceneIndex: number }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const styleSuffix =
      ' Cinematic ad, warm 3200K golden-hour color grade, bold blues and soft greens, shallow depth of field, smooth slow camera movement only, no cuts within clip, photorealistic quality, animate the subject naturally from the image, preserve the exact scene composition and person from the image, modern setting, SAME color grade and lighting as input image. Facial expression from the input image must be preserved exactly throughout the entire clip — do not alter or relax the expression.';

    const taskId = await kieCreateTask(apiKey, {
      model: 'bytedance/seedance-1.5-pro',
      input: {
        prompt: (scene.video_scenario || '') + styleSuffix,
        input_urls: [scene.image_url],
        aspect_ratio: '9:16',
        resolution: '480p',
        duration: '4',
        fixed_lens: true,
        generate_audio: false,
      },
    });
    tasks.push({ taskId, sceneIndex: i });
  }

  return tasks;
}
