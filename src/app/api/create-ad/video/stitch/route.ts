export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { stitchAndUploadVideo } from '@/lib/create-ad/video/stitch';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { ReportData, VideoScene } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const scenes = (body.scenes || []) as VideoScene[];
    const reportData = (body.report_data || {}) as ReportData;
    const adsConfig = body.ads_config || {};

    if (!scenes.length) {
      return NextResponse.json({ error: 'scenes array is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const result = await stitchAndUploadVideo(companyId, tokens, scenes, reportData, adsConfig, {
      audioUrl: body.audioUrl,
      audioKey: body.audioKey,
      audioDuration: body.audioDuration,
      fullScript: body.fullScript,
      itemId: body.itemId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video stitch failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/stitch]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
