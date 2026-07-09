import {
  createSceneImageTasks,
  matchImageResultsToScenes,
  pollSceneImages,
} from './images';
import {
  attachVideoUrlsToScenes,
  createSceneVideoTasks,
  pollSceneVideos,
} from './clips';
import { stitchAndUploadVideo } from './stitch';
import { publicStorageUrl } from '../supabase';
import type { CreateAdTokens, KieTaskResult, ReportData, VideoScene } from '../types';

export type GenerationResultItem = {
  success: boolean;
  state: string;
  prompt: string;
  taskId: string;
  index: number;
  failMsg?: string;
};

export type GenerationResponse = {
  totalCount: number;
  successCount: number;
  failCount: number;
  failedPrompts: Array<{ prompt: string; reason: string }>;
  results: GenerationResultItem[];
};

function buildGenerationResponse(
  scenes: VideoScene[],
  imagePoll: KieTaskResult[],
  videoPoll: KieTaskResult[]
): GenerationResponse {
  const results: GenerationResultItem[] = [];
  const failedPrompts: Array<{ prompt: string; reason: string }> = [];

  scenes.forEach((scene, index) => {
    const prompt = scene.prompt_clean || scene.prompt || '';
    const imgFail = imagePoll.find(
      (r) => r.prompt === prompt || imagePoll[index]?.taskId === r.taskId
    );
    const vidFail = videoPoll[index];

    if (!scene.image_url) {
      results.push({
        success: false,
        state: 'fail',
        prompt,
        taskId: imgFail?.taskId || '',
        index,
        failMsg: imgFail?.failMsg || 'Image generation failed',
      });
      failedPrompts.push({ prompt, reason: imgFail?.failMsg || 'Image generation failed' });
      return;
    }

    if (!scene.video_url) {
      results.push({
        success: false,
        state: 'fail',
        prompt,
        taskId: vidFail?.taskId || '',
        index,
        failMsg: vidFail?.failMsg || 'Video generation failed',
      });
      failedPrompts.push({ prompt, reason: vidFail?.failMsg || 'Video generation failed' });
      return;
    }

    results.push({
      success: true,
      state: 'success',
      prompt,
      taskId: scene.task_id || '',
      index,
    });
  });

  const failCount = results.filter((r) => !r.success).length;
  return {
    totalCount: results.length,
    successCount: results.length - failCount,
    failCount,
    failedPrompts,
    results,
  };
}

export async function runVideoGenerationForItem(
  companyId: string,
  tokens: CreateAdTokens,
  scenes: VideoScene[],
  reportData: ReportData,
  adsConfig: unknown,
  options: {
    audioKey?: string;
    audioUrl?: string;
    itemId?: number;
    fullScript?: string;
    audioDuration?: number | null;
  } = {}
): Promise<GenerationResponse> {
  const imageTasks = await createSceneImageTasks(tokens, scenes);
  const imagePoll = await pollSceneImages(
    tokens,
    imageTasks.map((t) => t.taskId)
  );

  let updatedScenes = matchImageResultsToScenes(
    scenes,
    imagePoll,
    imageTasks.map((t) => t.prompt)
  );

  const videoTasks = await createSceneVideoTasks(tokens, updatedScenes);
  const videoPoll = await pollSceneVideos(
    tokens,
    videoTasks.map((t) => t.taskId)
  );
  updatedScenes = attachVideoUrlsToScenes(updatedScenes, videoTasks, videoPoll);

  const response = buildGenerationResponse(updatedScenes, imagePoll, videoPoll);

  if (response.failCount === 0) {
    const audioUrl =
      options.audioUrl ||
      (options.audioKey
        ? publicStorageUrl('audio', options.audioKey.replace(/^audio\//, ''))
        : undefined);

    await stitchAndUploadVideo(companyId, tokens, updatedScenes, reportData, adsConfig, {
      audioUrl,
      audioDuration: options.audioDuration,
      fullScript: options.fullScript,
      itemId: options.itemId,
    });
  }

  return response;
}

export async function runVideoGenerationBatch(
  companyId: string,
  tokens: CreateAdTokens,
  items: Array<{
    itemId: number | string;
    scenes: VideoScene[];
    audioKey?: string;
    audioUrl?: string;
    fullScript?: string;
    audioDuration?: number | null;
  }>,
  reportData: ReportData,
  adsConfig: unknown
): Promise<GenerationResponse[]> {
  const responses: GenerationResponse[] = [];

  for (const item of items) {
    const res = await runVideoGenerationForItem(
      companyId,
      tokens,
      item.scenes,
      reportData,
      adsConfig,
      {
        audioKey: item.audioKey,
        audioUrl: item.audioUrl,
        itemId: Number(item.itemId),
        fullScript: item.fullScript,
        audioDuration: item.audioDuration,
      }
    );
    responses.push(res);
  }

  return responses;
}
