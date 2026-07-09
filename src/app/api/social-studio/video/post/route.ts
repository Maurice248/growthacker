export const dynamic = 'force-dynamic';
export const maxDuration = 180;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { postVideo } from '@/lib/social-studio/video-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const { jobId, video_url, descriptions, title } = body;
    if (!jobId || !video_url || !descriptions) {
      return NextResponse.json({ error: 'jobId, video_url, and descriptions are required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const result = await postVideo(
      companyId,
      tokens,
      jobId,
      video_url,
      descriptions,
      title || descriptions.facebook?.split('\n')[0] || 'Social video'
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video post failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[social-studio/video/post]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
