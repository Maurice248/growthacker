export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { startImageGeneration } from '@/lib/create-ad/image/generate';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { ImageAdConcept } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const concepts = (body.concepts || []) as ImageAdConcept[];

    if (!concepts.length) {
      return NextResponse.json({ error: 'concepts array is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const tasks = await startImageGeneration(tokens, concepts);

    return NextResponse.json({ tasks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image generation start failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/image/generate]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
