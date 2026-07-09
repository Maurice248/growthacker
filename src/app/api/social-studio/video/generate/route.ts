export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { startVideoRender } from '@/lib/social-studio/video-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';
import type { SocialScene } from '@/lib/social-studio/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const { jobId, story, scenes, audioUrl } = body;
    if (!jobId || !story || !Array.isArray(scenes)) {
      return NextResponse.json({ error: 'jobId, story, and scenes are required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const result = await startVideoRender(
      companyId,
      tokens,
      jobId,
      story,
      scenes as SocialScene[],
      audioUrl
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video render start failed';
    console.error('[social-studio/video/generate]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
