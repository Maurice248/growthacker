export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { generateVisualPrompts } from '@/lib/create-ad/video/visual-prompts';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { AdItemInput } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const { item, transcriptLines } = body as {
      item?: AdItemInput;
      transcriptLines?: string[];
    };

    if (!item?.id) {
      return NextResponse.json({ error: 'item with id is required' }, { status: 400 });
    }
    if (!Array.isArray(transcriptLines) || transcriptLines.length === 0) {
      return NextResponse.json({ error: 'transcriptLines array is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const scenes = await generateVisualPrompts(companyId, tokens, item, transcriptLines);

    return NextResponse.json({ scenes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Visual prompt generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/visual-prompts]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
