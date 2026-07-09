export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  pollImageTasks,
  startVideoClipTasks,
  pollVideoClipTasks,
  startStitchJob,
  pollStitchJob,
  completeVideoFinalize,
} from '@/lib/social-studio/video-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';
import type { SocialScene } from '@/lib/social-studio/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const {
      phase,
      jobId,
      story,
      scenes,
      imageTaskIds,
      videoTaskIds,
      audioUrl,
      stitchJobId,
    } = body;

    if (!jobId || !phase) {
      return NextResponse.json({ error: 'jobId and phase are required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const sceneList = (scenes || []) as SocialScene[];

    if (phase === 'images') {
      const result = await pollImageTasks(companyId, tokens, jobId, sceneList, imageTaskIds || []);
      return NextResponse.json({ phase: 'images', ...result });
    }

    if (phase === 'start_videos') {
      const result = await startVideoClipTasks(companyId, tokens, jobId, sceneList);
      return NextResponse.json({ phase: 'start_videos', ...result });
    }

    if (phase === 'videos') {
      const result = await pollVideoClipTasks(companyId, tokens, jobId, sceneList, videoTaskIds || []);
      return NextResponse.json({ phase: 'videos', ...result });
    }

    if (phase === 'start_stitch') {
      const result = await startStitchJob(companyId, tokens, jobId, sceneList, audioUrl);
      return NextResponse.json({ phase: 'start_stitch', ...result });
    }

    if (phase === 'stitch') {
      if (!stitchJobId) {
        return NextResponse.json({ error: 'stitchJobId is required' }, { status: 400 });
      }
      const result = await pollStitchJob(companyId, tokens, jobId, stitchJobId);
      return NextResponse.json({ phase: 'stitch', ...result });
    }

    if (phase === 'complete_finalize') {
      if (!stitchJobId || !story) {
        return NextResponse.json({ error: 'stitchJobId and story are required' }, { status: 400 });
      }
      const result = await completeVideoFinalize(companyId, tokens, jobId, story, sceneList, stitchJobId);
      return NextResponse.json({ phase: 'done', ...result });
    }

    return NextResponse.json({ error: `Unknown phase: ${phase}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video poll failed';
    console.error('[social-studio/video/poll]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
