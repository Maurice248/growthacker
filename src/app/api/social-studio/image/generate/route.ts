export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { startImageGeneration } from '@/lib/social-studio/image-pipeline';
import { getSocialStudioTokens } from '@/lib/social-studio/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const topic = String(body.prompt || body.text || '').trim();
    if (!topic) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const tokens = await getSocialStudioTokens(companyId);
    const result = await startImageGeneration(
      companyId,
      tokens,
      topic,
      body.ratio || body.aspect_ratio
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[social-studio/image/generate]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
