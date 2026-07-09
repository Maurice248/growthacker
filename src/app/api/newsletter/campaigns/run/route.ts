export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runCampaignBatch } from '@/lib/newsletter/send';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const campaignId = String(body.campaignId || '').trim();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const campaign = await prisma.newsletterCampaign.findFirst({
      where: { id: campaignId, companyId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const result = await runCampaignBatch(campaignId, { force: true });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Campaign run failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[newsletter/campaigns/run]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
