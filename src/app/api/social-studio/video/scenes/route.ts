export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { acceptStoryAndGenerateScenes } from '@/lib/social-studio/video-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const story = String(body.generated_story || body.story || '').trim();
    if (!story) {
      return NextResponse.json({ error: 'generated_story is required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const result = await acceptStoryAndGenerateScenes(companyId, tokens, story, body);

    return NextResponse.json({
      status: 'accepted',
      jobId: result.jobId,
      scenes: result.scenes,
      audioUrl: result.audioUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scene generation failed';
    console.error('[social-studio/video/scenes]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
