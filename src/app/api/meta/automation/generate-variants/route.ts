export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { after, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runVariantGeneration, startVariantGeneration } from '@/lib/meta-automation/generate';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const numVariants = Math.min(10, Math.max(2, Number(body.numVariants) || 3));
    const evalLengthDays = Math.min(30, Math.max(1, Number(body.evalLengthDays) || 7));
    const dailyBudgetCents = Math.max(100, Number(body.dailyBudgetCents) || 100);

    const automation = await startVariantGeneration({
      companyId,
      baseAdId: body.baseAdId,
      baseAdText: body.baseAdText,
      numVariants,
      evalLengthDays,
      dailyBudgetCents,
      automationEnabled: Boolean(body.automationEnabled),
    });

    after(async () => {
      try {
        await runVariantGeneration(automation.id);
      } catch (err) {
        console.error('[meta/automation/generate-variants]', automation.id, err);
      }
    });

    return NextResponse.json({ automation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start variant generation';
    console.error('[meta/automation/generate-variants]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
