export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { pollImageTask } from '@/lib/social-studio/image-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const { jobId, taskId, topic } = body;
    if (!jobId || !taskId || !topic) {
      return NextResponse.json({ error: 'jobId, taskId, and topic are required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const result = await pollImageTask(companyId, tokens, jobId, taskId, topic);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image poll failed';
    console.error('[social-studio/image/poll]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
