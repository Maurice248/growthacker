export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runCompetitorAnalysis, type CompetitorAnalysisInput } from '@/lib/competitor-analysis';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = (await request.json()) as CompetitorAnalysisInput & { action?: string };

    const result = await runCompetitorAnalysis(companyId, {
      topic: body.topic,
      keywords: body.keywords || [],
      countries: body.countries || [],
      max_ads: body.max_ads,
      only_active: body.only_active,
      sort: body.sort,
      scrape_image: body.scrape_image,
      scrape_video: body.scrape_video,
      brand_config: body.brand_config,
      brand_snapshot_id: body.brand_snapshot_id,
      timestamp: body.timestamp,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Analysis failed', ...result },
        { status: result.error?.includes('not configured') ? 503 : 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Competitor analysis failed';
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || message.includes('timed out'));
    console.error('[competitor-analysis]', err);
    return NextResponse.json(
      { error: message, isTimeout },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
