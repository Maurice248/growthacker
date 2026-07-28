import {
  getSocialJob,
  mergeSocialJobInput,
  updateSocialJob,
  type SocialStudioBackgroundKind,
} from '@/lib/social-studio/jobs';
import {
  runFullSocialImagePipeline,
  runFullSocialVideoPipeline,
  runSocialVideoRenderJob,
} from '@/lib/social-studio/run-full-pipelines';
import type { SocialScene, VideoFormInput } from '@/lib/social-studio/types';
import { prisma } from '@/lib/prisma';

export async function executeSocialStudioJob(jobId: string): Promise<void> {
  const row = await prisma.socialStudioJob.findUnique({ where: { id: jobId } });
  if (!row) return;

  const companyId = row.companyId;
  const input = (row.input || {}) as Record<string, unknown>;
  const kind = (input.backgroundKind || row.kind) as SocialStudioBackgroundKind;

  await updateSocialJob(jobId, companyId, {
    status: 'running',
    error: null,
    input: mergeSocialJobInput(input, { runStatus: 'running' }),
  });

  try {
    if (kind === 'image') {
      const topic = String(input.prompt || input.topic || '').trim();
      const ratio = input.ratio ? String(input.ratio) : undefined;
      if (!topic) throw new Error('prompt is required');
      await runFullSocialImagePipeline(companyId, jobId, topic, ratio);
    } else if (kind === 'video') {
      const form = { ...input };
      delete form.backgroundJob;
      delete form.runStatus;
      delete form.backgroundKind;
      if (!String(form.description || '').trim()) {
        throw new Error('description is required');
      }
      await runFullSocialVideoPipeline(companyId, jobId, form as VideoFormInput);
    } else if (kind === 'video_render') {
      const story = String(input.story || row.story || '');
      const scenes = (input.scenes || row.scenes) as SocialScene[] | null;
      const audioUrl =
        typeof input.audioUrl === 'string' ? input.audioUrl : undefined;
      if (!story || !scenes?.length) {
        throw new Error('story and scenes are required');
      }
      await runSocialVideoRenderJob(companyId, jobId, story, scenes, audioUrl);
    } else {
      throw new Error(`Unknown background kind: ${kind}`);
    }

    const finished = await getSocialJob(jobId, companyId);
    await updateSocialJob(jobId, companyId, {
      input: mergeSocialJobInput(finished?.input, {
        backgroundJob: true,
        runStatus: 'completed',
      }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Creator Studio job failed';
    console.error('[social-studio/execute-job]', jobId, err);
    const current = await getSocialJob(jobId, companyId);
    await updateSocialJob(jobId, companyId, {
      status: 'failed',
      error: message,
      input: mergeSocialJobInput(current?.input, {
        backgroundJob: true,
        runStatus: 'failed',
      }),
    });
  }
}
