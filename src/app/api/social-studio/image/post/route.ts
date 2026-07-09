export const dynamic = 'force-dynamic';
export const maxDuration = 180;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { postImage } from '@/lib/social-studio/image-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const { jobId, image_url, descriptions } = body;
    if (!jobId || !image_url || !descriptions) {
      return NextResponse.json({ error: 'jobId, image_url, and descriptions are required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const result = await postImage(companyId, tokens, jobId, image_url, descriptions);

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image post failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[social-studio/image/post]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
