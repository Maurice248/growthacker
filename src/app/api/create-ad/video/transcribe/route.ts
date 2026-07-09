export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { transcribeAndSegment } from '@/lib/create-ad/video/transcribe';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const { audioUrl } = body as { audioUrl?: string };

    if (!audioUrl?.trim()) {
      return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const result = await transcribeAndSegment(tokens, audioUrl);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/transcribe]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
