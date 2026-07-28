export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runFullImageAdPipeline } from '@/lib/create-ad/run-image-pipeline';
import type { ReportData } from '@/lib/create-ad/types';

/** @deprecated Prefer POST /api/create-ad/jobs with kind=image for background execution */
export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const reportData = (body.report_data || {}) as ReportData;
    const adsConfig = body.ads_config || {};

    const result = await runFullImageAdPipeline(companyId, reportData, adsConfig);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image ad pipeline failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/image/run]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
