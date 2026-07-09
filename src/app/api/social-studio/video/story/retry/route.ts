export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { retryStory } from '@/lib/social-studio/video-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const originalStory = String(body.generated_story || body.story || '').trim();
    const retryPrompt = String(body.retry_prompt || '').trim();
    if (!originalStory || !retryPrompt) {
      return NextResponse.json({ error: 'generated_story and retry_prompt are required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const result = await retryStory(companyId, tokens, body, originalStory, retryPrompt);

    return NextResponse.json({ output: result, story: result.story });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Story retry failed';
    console.error('[social-studio/video/story/retry]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
