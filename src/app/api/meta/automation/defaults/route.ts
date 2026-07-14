export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  getAdAutomationDefaults,
  upsertAdAutomationDefaults,
} from '@/lib/meta-automation/defaults';

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const defaults = await getAdAutomationDefaults(companyId);
    return NextResponse.json({ defaults });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load defaults';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const defaults = await upsertAdAutomationDefaults(companyId, {
      numVariants: body.numVariants !== undefined ? Number(body.numVariants) : undefined,
      evalLengthDays:
        body.evalLengthDays !== undefined ? Number(body.evalLengthDays) : undefined,
      dailyBudgetCents:
        body.dailyBudgetCents !== undefined ? Number(body.dailyBudgetCents) : undefined,
      winnerMetric: body.winnerMetric,
    });

    return NextResponse.json({ defaults });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save defaults';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
