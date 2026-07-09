export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { resolveAudioForItem } from '@/lib/create-ad/video/audio';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const { voiceId, audioStyle, script } = body as {
      voiceId?: string;
      audioStyle?: string;
      script?: string;
    };

    if (!script?.trim()) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const result = await resolveAudioForItem(tokens, { voiceId, audioStyle, script });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Audio generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/audio]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
