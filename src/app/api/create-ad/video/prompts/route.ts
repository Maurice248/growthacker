export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runVideoPromptsPipeline } from '@/lib/create-ad/video/prompts-pipeline';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { AdItemInput } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const adsConfig = body.ads_config || {};
    const items = ((adsConfig as { items?: AdItemInput[] }).items || []) as AdItemInput[];

    const tokens = await getCreateAdTokens(companyId);
    const results = await runVideoPromptsPipeline(companyId, tokens, items);

    return NextResponse.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video prompt generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/prompts]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
