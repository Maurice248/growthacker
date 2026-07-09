export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runVideoGenerationBatch } from '@/lib/create-ad/video/generate';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { ReportData, VideoScene } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const reportData = (body.report_data || {}) as ReportData;
    const adsConfig = body.ads_config || {};
    const generatedPrompts = (body.generated_prompts || {}) as Record<string, VideoScene[]>;
    const audioKeys = (body.audioKeys || body.audio_keys || {}) as Record<string, string>;
    const audioUrls = (body.audioUrls || {}) as Record<string, string>;

    const items = Object.entries(generatedPrompts)
      .filter(([, scenes]) => Array.isArray(scenes) && scenes.length > 0)
      .map(([itemId, scenes]) => ({
        itemId,
        scenes,
        audioKey: audioKeys[itemId] || '',
        audioUrl: audioUrls[itemId] || '',
      }));

    if (!items.length) {
      return NextResponse.json({ error: 'generated_prompts is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const responses = await runVideoGenerationBatch(
      companyId,
      tokens,
      items,
      reportData,
      adsConfig
    );

    return NextResponse.json(responses);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/generate]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
