export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { generateVoiceoverScript } from '@/lib/create-ad/video/script';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { AdItemInput } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const item = body as AdItemInput;

    if (!item?.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const result = await generateVoiceoverScript(companyId, tokens, item);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Voiceover script generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/script]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
