export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { generateStory } from '@/lib/social-studio/video-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const tokens = await getSocialStudioTokens(companyId);
    const result = await generateStory(companyId, tokens, body);

    return NextResponse.json({ output: result, story: result.story });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Story generation failed';
    console.error('[social-studio/video/story]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
