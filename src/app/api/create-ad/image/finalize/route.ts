export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { finalizeImageAds } from '@/lib/create-ad/image/finalize';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { ImageAdConcept, KieTaskResult, ReportData } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const concepts = (body.concepts || []) as ImageAdConcept[];
    const pollResults = (body.pollResults || []) as KieTaskResult[];
    const reportData = (body.report_data || {}) as ReportData;
    const adsConfig = body.ads_config || {};

    const items = concepts.map((concept, i) => ({
      concept,
      task: pollResults[i] || pollResults.find((r) => r.prompt === concept.prompt) || {
        taskId: '',
        state: 'fail',
        resultUrl: null,
        failMsg: 'No poll result',
      },
    }));

    const tokens = await getCreateAdTokens(companyId);
    const results = await finalizeImageAds(companyId, tokens, items, reportData, adsConfig);

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Image finalize failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/image/finalize]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
