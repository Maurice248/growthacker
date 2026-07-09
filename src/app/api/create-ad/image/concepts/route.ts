export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { generateImageConcepts, structurizeReport } from '@/lib/create-ad/image/concepts';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { AdItemInput, ReportData } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const reportData = (body.report_data || {}) as ReportData;
    const adsConfig = body.ads_config || {};
    const items = ((adsConfig as { items?: AdItemInput[] }).items || []).filter(
      (i) => i.type === 'image'
    );

    if (!items.length) {
      return NextResponse.json({ error: 'No image items in ads_config' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const structurizerOutput = await structurizeReport(companyId, tokens, reportData, adsConfig);
    const concepts = await generateImageConcepts(
      companyId,
      tokens,
      items,
      reportData,
      structurizerOutput
    );

    return NextResponse.json({ concepts, structurizerOutput });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image concept generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/image/concepts]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
