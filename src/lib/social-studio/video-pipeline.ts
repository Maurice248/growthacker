import { resolveSocialContext } from './config';
import { createSocialJob, getSocialJob, updateSocialJob } from './jobs';
import { kieCreateImageTask, kieCreateVideoTask, kiePollTasks } from './kie';
import { chatCompletionJson } from './openai';
import { formatPlatformDescriptions } from './platform-format';
import {
  buildStorySystem,
  buildStoryUser,
  buildStoryRetrySystem,
  buildStoryRetryUser,
  buildVisualPromptsSystem,
  buildVisualPromptsUser,
  buildVideoMetadataSystem,
  buildVideoMetadataUser,
} from './prompts';
import { generateElevenLabsAudio } from './audio';
import { transcribeAndSegment } from './transcribe';
import { formatUploadPostAuth } from './upload-post';
import { uploadVideoToPublicUrl } from './storage';
import { postVideoToPlatforms } from './upload-post';
import { requireToken } from './tokens';
import type {
  KieTaskResult,
  PlatformDescriptions,
  SocialScene,
  SocialStudioTokens,
  VideoFormInput,
} from './types';

const CLIP_DURATION = 4;
const SAFETY_BUFFER = 0.3;

function sanitizePrompt(str: string): string {
  return (str || '')
    .replace(/"/g, "'")
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

export async function generateStory(
  companyId: string,
  tokens: SocialStudioTokens,
  input: VideoFormInput
): Promise<{ story: string }> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveSocialContext(companyId);

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: buildStorySystem(ctx) },
      { role: 'user', content: buildStoryUser(input, ctx) },
    ],
    { model: 'gpt-4o-mini', jsonMode: true, timeoutMs: 180_000 }
  );

  return { story: String(parsed.story || '') };
}

export async function retryStory(
  companyId: string,
  tokens: SocialStudioTokens,
  input: VideoFormInput,
  originalStory: string,
  retryPrompt: string
): Promise<{ story: string }> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveSocialContext(companyId);

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: buildStoryRetrySystem(ctx) },
      { role: 'user', content: buildStoryRetryUser(originalStory, retryPrompt, input) },
    ],
    { model: 'gpt-4o-mini', jsonMode: true, timeoutMs: 180_000 }
  );

  return { story: String(parsed.story || '') };
}

export async function generateScenes(
  companyId: string,
  tokens: SocialStudioTokens,
  story: string,
  input: VideoFormInput
): Promise<{ scenes: SocialScene[]; audioUrl: string }> {
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveSocialContext(companyId);
  const voiceId = input.voice || 'KLoLpdGWK7agg0O2TJYg';

  const { publicUrl: audioUrl } = await generateElevenLabsAudio(tokens, voiceId, story);
  const transcript = await transcribeAndSegment(tokens, audioUrl);

  const parsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: buildVisualPromptsSystem(ctx) },
      { role: 'user', content: buildVisualPromptsUser(story, transcript.text) },
    ],
    { model: 'gpt-4o', jsonMode: true, timeoutMs: 300_000 }
  );

  const rawScenes = (parsed.scenes as Array<Record<string, unknown>>) || [];
  const scenes: SocialScene[] = rawScenes.map((s, index) => ({
    scene: Number(s.scene ?? index + 1),
    script_line: String(s.script_line || transcript.text[index] || ''),
    prompt: String(s.prompt || ''),
    prompt_clean: sanitizePrompt(String(s.prompt || '')),
    video_scenario: String(s.video_scenario || ''),
  }));

  return { scenes, audioUrl };
}

export async function acceptStoryAndGenerateScenes(
  companyId: string,
  tokens: SocialStudioTokens,
  story: string,
  input: VideoFormInput
): Promise<{ jobId: string; scenes: SocialScene[]; audioUrl: string }> {
  const job = await createSocialJob(companyId, 'video', input, 'Accepting story and generating prompts...');
  await updateSocialJob(job.id, companyId, { story, status: 'Generating scene prompts...' });

  const { scenes, audioUrl } = await generateScenes(companyId, tokens, story, input);

  await updateSocialJob(job.id, companyId, {
    status: 'Scenes ready for review',
    scenes,
    input: { ...input, audioUrl },
  });

  return { jobId: job.id, scenes, audioUrl };
}

function buildFfmpegConcatBody(scenes: SocialScene[], audioUrl?: string) {
  const videoUrls = scenes
    .sort((a, b) => a.scene - b.scene)
    .map((s) => s.video_url)
    .filter(Boolean) as string[];

  if (!videoUrls.length) throw new Error('No video URLs found for stitching');

  const totalVideoDuration = videoUrls.length * CLIP_DURATION;
  const outputDuration = totalVideoDuration;
  const videoInputFlags = videoUrls.map((_, i) => `-i {input${i}}`).join(' ');
  const audioInputFlag = audioUrl ? ` -i {input${videoUrls.length}}` : '';
  const inputs = `${videoInputFlags}${audioInputFlag}`;

  const filterParts: string[] = [];
  videoUrls.forEach((_, i) => {
    filterParts.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${i}]`
    );
  });

  const concatInputs = videoUrls.map((_, i) => `[v${i}]`).join('');
  const filterComplex = [
    ...filterParts,
    `${concatInputs}concat=n=${videoUrls.length}:v=1:a=0,format=yuv420p[v]`,
  ].join(',');

  const audioMap = audioUrl ? `-map ${videoUrls.length}:a ` : '';
  const audioEncode = audioUrl ? `-c:a aac -b:a 192k -ar 44100 -ac 2 ` : `-an `;

  const fullCommand =
    `ffmpeg -y ${inputs} ` +
    `-filter_complex "${filterComplex}" ` +
    `-map "[v]" ${audioMap}` +
    `-t ${outputDuration.toFixed(2)} ` +
    `-c:v libx264 -preset superfast -crf 23 ` +
    `${audioEncode}` +
    `-avoid_negative_ts make_zero ` +
    `-movflags +faststart {output}`;

  return {
    files: audioUrl ? [...videoUrls, audioUrl] : [...videoUrls],
    full_command: fullCommand,
    output_extension: 'mp4',
  };
}

async function submitStitchJob(
  uploadPostToken: string,
  concatBody: ReturnType<typeof buildFfmpegConcatBody>
): Promise<string> {
  const submitRes = await fetch('https://api.upload-post.com/api/uploadposts/ffmpeg/jobs/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: formatUploadPostAuth(uploadPostToken),
    },
    body: JSON.stringify(concatBody),
    signal: AbortSignal.timeout(90_000),
  });

  if (!submitRes.ok) {
    throw new Error(`FFmpeg submit HTTP ${submitRes.status}: ${(await submitRes.text()).slice(0, 300)}`);
  }

  const { job_id: stitchJobId } = (await submitRes.json()) as { job_id?: string };
  if (!stitchJobId) throw new Error('FFmpeg missing job_id');
  return stitchJobId;
}

async function fetchStitchJobStatus(uploadPostToken: string, stitchJobId: string): Promise<string> {
  const auth = formatUploadPostAuth(uploadPostToken);
  const pollRes = await fetch(`https://api.upload-post.com/api/uploadposts/ffmpeg/jobs/${stitchJobId}`, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!pollRes.ok) throw new Error(`FFmpeg poll HTTP ${pollRes.status}`);

  const data = (await pollRes.json()) as { status?: string };
  return (data.status || '').toUpperCase();
}

async function downloadStitchJob(uploadPostToken: string, stitchJobId: string): Promise<Buffer> {
  const auth = formatUploadPostAuth(uploadPostToken);
  const dlRes = await fetch(
    `https://api.upload-post.com/api/uploadposts/ffmpeg/jobs/${stitchJobId}/download`,
    { headers: { Authorization: auth, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(300_000) }
  );
  if (!dlRes.ok) throw new Error(`FFmpeg download HTTP ${dlRes.status}`);
  return Buffer.from(await dlRes.arrayBuffer());
}

function mergeJobInput(existing: unknown, patch: Record<string, unknown>) {
  const base = existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {};
  return { ...base, ...patch };
}

export async function startStitchJob(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  scenes: SocialScene[],
  audioUrl?: string
): Promise<{ stitchJobId: string }> {
  const job = await getSocialJob(jobId, companyId);
  if (!job) throw new Error('Job not found');

  const existingInput = mergeJobInput(job.input, {});
  const existingStitchJobId =
    typeof existingInput.stitchJobId === 'string' ? existingInput.stitchJobId : undefined;
  if (existingStitchJobId) {
    return { stitchJobId: existingStitchJobId };
  }

  const uploadPostKey = requireToken(tokens, 'uploadPost', 'Upload Post API token');
  const stitchJobId = await submitStitchJob(uploadPostKey, buildFfmpegConcatBody(scenes, audioUrl));

  await updateSocialJob(jobId, companyId, {
    status: 'Stitching final video...',
    scenes,
    input: mergeJobInput(job.input, { audioUrl, stitchJobId }),
    error: null,
  });

  return { stitchJobId };
}

export async function pollStitchJob(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  stitchJobId: string
): Promise<{ complete: boolean; failed?: boolean; error?: string }> {
  const uploadPostKey = requireToken(tokens, 'uploadPost', 'Upload Post API token');
  const status = await fetchStitchJobStatus(uploadPostKey, stitchJobId);

  if (status === 'FINISHED') {
    await updateSocialJob(jobId, companyId, { status: 'Stitch complete — preparing video...' });
    return { complete: true };
  }

  if (status === 'FAILED' || status === 'ERROR') {
    const message = 'FFmpeg stitch failed on Upload Post';
    await updateSocialJob(jobId, companyId, { status: 'Video stitch failed', error: message });
    return { complete: false, failed: true, error: message };
  }

  await updateSocialJob(jobId, companyId, { status: 'Stitching final video...' });
  return { complete: false };
}

export async function completeVideoFinalize(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  story: string,
  scenes: SocialScene[],
  stitchJobId: string
): Promise<{ assetUrl: string; descriptions: PlatformDescriptions }> {
  const uploadPostKey = requireToken(tokens, 'uploadPost', 'Upload Post API token');
  const openaiKey = requireToken(tokens, 'openai', 'OpenAI API token');
  const ctx = await resolveSocialContext(companyId);

  await updateSocialJob(jobId, companyId, { status: 'Downloading stitched video...', scenes });

  const videoBuffer = await downloadStitchJob(uploadPostKey, stitchJobId);
  const assetUrl = await uploadVideoToPublicUrl(videoBuffer, companyId);

  const metaParsed = await chatCompletionJson(
    openaiKey,
    [
      { role: 'system', content: buildVideoMetadataSystem(ctx) },
      { role: 'user', content: buildVideoMetadataUser(story, ctx) },
    ],
    { model: 'gpt-4o', jsonMode: true }
  );

  const formatted = formatPlatformDescriptions(
    {
      video_title: String(metaParsed.video_title || ''),
      post: String(metaParsed.post || ''),
      tags: String(metaParsed.tags || ''),
      caption: String(metaParsed.caption || ''),
    },
    assetUrl
  );

  await updateSocialJob(jobId, companyId, {
    status: 'Video ready for review',
    assetUrl,
    scenes,
    descriptions: formatted.descriptions,
    error: null,
  });

  return { assetUrl, descriptions: formatted.descriptions };
}

export async function startVideoRender(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  story: string,
  scenes: SocialScene[],
  audioUrl?: string
): Promise<{ imageTaskIds: string[]; videoTaskIds: string[] }> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');

  await updateSocialJob(jobId, companyId, { status: 'Generating scene images...', story, scenes });

  const imageTaskIds: string[] = [];
  for (const scene of scenes) {
    const taskId = await kieCreateImageTask(kieKey, scene.prompt_clean || scene.prompt, '9:16');
    imageTaskIds.push(taskId);
  }

  await updateSocialJob(jobId, companyId, {
    status: 'Polling scene images...',
    input: { imageTaskIds, audioUrl },
  });

  return { imageTaskIds, videoTaskIds: [] };
}

export async function pollImageTasks(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  scenes: SocialScene[],
  imageTaskIds: string[]
): Promise<{
  complete: boolean;
  scenes?: SocialScene[];
  failures?: KieTaskResult[];
}> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  const imageResults = await kiePollTasks(kieKey, imageTaskIds);
  const failures = imageResults.filter((r) => r.state === 'fail' || r.state === 'failed');
  if (failures.length) {
    await updateSocialJob(jobId, companyId, { status: 'Scene image generation failed', error: failures[0]?.failMsg });
    return { complete: false, failures };
  }
  if (!imageResults.every((r) => r.state === 'success')) {
    return { complete: false };
  }

  const scenesWithImages = scenes.map((scene, i) => ({
    ...scene,
    image_url: imageResults[i]?.resultUrl || scene.image_url,
  }));

  await updateSocialJob(jobId, companyId, {
    status: 'Scene images ready',
    scenes: scenesWithImages,
  });

  return { complete: true, scenes: scenesWithImages };
}

export async function startVideoClipTasks(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  scenes: SocialScene[]
): Promise<{ videoTaskIds: string[] }> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  await updateSocialJob(jobId, companyId, { status: 'Generating scene videos...', scenes });

  const videoTaskIds: string[] = [];
  for (const scene of scenes) {
    if (!scene.image_url) throw new Error(`Scene ${scene.scene} missing image URL`);
    const taskId = await kieCreateVideoTask(kieKey, {
      video_scenario: scene.video_scenario,
      image_url: scene.image_url,
    });
    videoTaskIds.push(taskId);
  }

  return { videoTaskIds };
}

export async function pollVideoClipTasks(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  scenes: SocialScene[],
  videoTaskIds: string[]
): Promise<{
  complete: boolean;
  scenes?: SocialScene[];
  failures?: KieTaskResult[];
}> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');
  const videoResults = await kiePollTasks(kieKey, videoTaskIds);
  const failures = videoResults.filter((r) => r.state === 'fail' || r.state === 'failed');
  if (failures.length) {
    await updateSocialJob(jobId, companyId, { status: 'Scene video generation failed', error: failures[0]?.failMsg });
    return { complete: false, failures };
  }
  if (!videoResults.every((r) => r.state === 'success')) {
    return { complete: false };
  }

  const scenesComplete = scenes.map((scene, i) => ({
    ...scene,
    video_url: videoResults[i]?.resultUrl || scene.video_url,
  }));

  await updateSocialJob(jobId, companyId, {
    status: 'Scene videos ready',
    scenes: scenesComplete,
  });

  return { complete: true, scenes: scenesComplete };
}

export async function postVideo(
  companyId: string,
  tokens: SocialStudioTokens,
  jobId: string,
  videoUrl: string,
  descriptions: PlatformDescriptions,
  title: string
): Promise<{ results: unknown[] }> {
  const ctx = await resolveSocialContext(companyId);
  const result = await postVideoToPlatforms(tokens, ctx, videoUrl, descriptions, title);
  await updateSocialJob(jobId, companyId, { status: 'Video Posted' });
  return result;
}

export async function startManualVideo(
  companyId: string,
  tokens: SocialStudioTokens,
  input: VideoFormInput
): Promise<{ jobId: string; story: string }> {
  const job = await createSocialJob(companyId, 'video', input, 'Starting video process...');
  const { story } = await generateStory(companyId, tokens, input);
  await updateSocialJob(job.id, companyId, { story, status: 'Story generated' });
  return { jobId: job.id, story };
}
