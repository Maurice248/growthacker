export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { getActiveVariantGeneration } from '@/lib/meta-automation/active-generation';

/** Resume polling after navigation — same idea as GET /api/create-ad/jobs?active=1 */
export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const automation = await getActiveVariantGeneration(companyId);
    return NextResponse.json({ automation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load active variant generation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
