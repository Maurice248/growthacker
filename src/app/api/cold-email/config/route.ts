export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { getOutreachConfig, upsertOutreachConfig } from '@/lib/cold-email/config';
import { resolveOutreachContext } from '@/lib/cold-email/company-context';

export async function GET() {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const [config, context] = await Promise.all([
    getOutreachConfig(companyId),
    resolveOutreachContext(companyId),
  ]);

  return NextResponse.json({ config, context });
}

export async function PUT(req: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const body = await req.json();

  const config = await upsertOutreachConfig(companyId, {
    instantlyCampaignId: body.instantlyCampaignId,
    senderName: body.senderName,
    defaultCtaLink: body.defaultCtaLink,
    cleanupIntervalDays: body.cleanupIntervalDays,
    cleanupBatchSize: body.cleanupBatchSize,
    dailySendLimit: body.dailySendLimit,
    active: body.active,
  });

  return NextResponse.json({ config });
}
