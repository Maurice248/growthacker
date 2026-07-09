export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getResendStats } from '@/lib/resend-stats';
import { requireApiCompanyId } from '@/lib/api-auth';
import { getNewsletterTokens } from '@/lib/newsletter/tokens';

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const daysParam = request.nextUrl.searchParams.get('days');
    const days = daysParam ? Number.parseInt(daysParam, 10) : undefined;
    const tokens = await getNewsletterTokens(companyId);
    const supabase = getSupabaseAdmin();
    const data = await getResendStats(
      supabase,
      Number.isFinite(days) ? days : undefined,
      tokens.resend
    );
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load resend stats';
    console.error('[API resend/stats]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
