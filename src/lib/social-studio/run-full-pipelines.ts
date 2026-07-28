import { generateImagePrompt, pollImageTask } from './image-pipeline';
import { kieCreateImageTask, kiePollTasksUntilComplete } from './kie';
import { getSocialJob, mergeSocialJobInput, updateSocialJob } from './jobs';
import { getSocialStudioTokens, requireToken } from './tokens';
import type { SocialScene, VideoFormInput } from './types';
import {
  completeVideoFinalize,
  generateScenes,
  generateStory,
  pollImageTasks,
  pollStitchJob,
  pollVideoClipTasks,
  startStitchJob,
  startVideoClipTasks,
  startVideoRender,
} from './video-pipeline';
import { resolveSocialContext } from './config';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runFullSocialImagePipeline(
  companyId: string,
  jobId: string,
  topic: string,
  ratio?: string
) {
  const tokens = await getSocialStudioTokens(companyId);
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  const ctx = await resolveSocialContext(companyId);

  await updateSocialJob(jobId, companyId, {
    status: 'Generating image prompt...',
    input: mergeSocialJobInput(
      (await getSocialJob(jobId, companyId))?.input,
      { topic, ratio }
    ),
    error: null,
  });

  const imagePrompt = await generateImagePrompt(companyId, tokens, topic);
  const taskId = await kieCreateImageTask(kieKey, imagePrompt, ratio || ctx.defaultImageRatio || '1:1');

  await updateSocialJob(jobId, companyId, {
    status: 'Generating image...',
    input: mergeSocialJobInput((await getSocialJob(jobId, companyId))?.input, {
      topic,
      ratio,
      imagePrompt,
      taskId,
    }),
  });

  const pollResults = await kiePollTasksUntilComplete(kieKey, [taskId]);
  const failed = pollResults.find((r) => r.state === 'fail' || r.state === 'failed');
  if (failed) {
    throw new Error(failed.failMsg || 'Image generation failed');
  }

  await pollImageTask(companyId, tokens, jobId, taskId, topic);
}

export async function runVideoRenderPipelineForJob(
  companyId: string,
  jobId: string,
  story: string,
  scenes: SocialScene[],
  audioUrl?: string
) {
  const tokens = await getSocialStudioTokens(companyId);

  const renderStart = await startVideoRender(companyId, tokens, jobId, story, scenes, audioUrl);
  const imageTaskIds = renderStart.imageTaskIds || [];

  let scenesWithImages = scenes;
  for (let i = 0; i < 120; i++) {
    const imagePoll = await pollImageTasks(companyId, tokens, jobId, scenesWithImages, imageTaskIds);
    if (imagePoll.failures?.length) {
      throw new Error(imagePoll.failures[0]?.failMsg || 'Scene image generation failed');
    }
    if (imagePoll.complete && imagePoll.scenes) {
      scenesWithImages = imagePoll.scenes;
      break;
    }
    if (i === 119) throw new Error('Scene image generation timed out');
    await sleep(5000);
  }

  const videoStart = await startVideoClipTasks(companyId, tokens, jobId, scenesWithImages);
  const videoTaskIds = videoStart.videoTaskIds || [];

  let scenesComplete = scenesWithImages;
  for (let i = 0; i < 120; i++) {
    const videoPoll = await pollVideoClipTasks(
      companyId,
      tokens,
      jobId,
      scenesComplete,
      videoTaskIds
    );
    if (videoPoll.failures?.length) {
      throw new Error(videoPoll.failures[0]?.failMsg || 'Scene video generation failed');
    }
    if (videoPoll.complete && videoPoll.scenes) {
      scenesComplete = videoPoll.scenes;
      break;
    }
    if (i === 119) throw new Error('Scene video generation timed out');
    await sleep(5000);
  }

  await updateSocialJob(jobId, companyId, { status: 'Stitching scene clips into final video...' });
  const stitchStart = await startStitchJob(companyId, tokens, jobId, scenesComplete, audioUrl);
  const stitchJobId = stitchStart.stitchJobId;

  for (let i = 0; i < 120; i++) {
    const stitchPoll = await pollStitchJob(companyId, tokens, jobId, stitchJobId);
    if (stitchPoll.failed) {
      throw new Error(stitchPoll.error || 'Video stitch failed');
    }
    if (stitchPoll.complete) break;
    if (i === 119) throw new Error('Video stitch timed out');
    await sleep(10_000);
  }

  await updateSocialJob(jobId, companyId, { status: 'Finalizing video and captions...' });
  await completeVideoFinalize(companyId, tokens, jobId, story, scenesComplete, stitchJobId);
}

export async function runFullSocialVideoPipeline(
  companyId: string,
  jobId: string,
  input: VideoFormInput
) {
  const tokens = await getSocialStudioTokens(companyId);

  await updateSocialJob(jobId, companyId, {
    status: 'Generating story...',
    input: mergeSocialJobInput((await getSocialJob(jobId, companyId))?.input, input),
    error: null,
  });

  const { story } = await generateStory(companyId, tokens, input);
  await updateSocialJob(jobId, companyId, { story, status: 'Generating scene prompts...' });

  const { scenes, audioUrl } = await generateScenes(companyId, tokens, story, input);
  await updateSocialJob(jobId, companyId, {
    status: 'Rendering video...',
    scenes,
    input: mergeSocialJobInput((await getSocialJob(jobId, companyId))?.input, { ...input, audioUrl }),
  });

  await runVideoRenderPipelineForJob(companyId, jobId, story, scenes, audioUrl);
}

/** Used when story/scenes were already reviewed in the UI. */
export async function runSocialVideoRenderJob(
  companyId: string,
  jobId: string,
  story: string,
  scenes: SocialScene[],
  audioUrl?: string
) {
  await runVideoRenderPipelineForJob(companyId, jobId, story, scenes, audioUrl);
}
