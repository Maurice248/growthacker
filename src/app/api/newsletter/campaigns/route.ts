export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { createCampaign, getCampaignsSummary } from '@/lib/newsletter/send';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const data = await getCampaignsSummary(companyId);
    return NextResponse.json({
      campaigns: data.campaigns,
      leadCounts: { subscribers: data.subscriberCount },
      subscriberCount: data.subscriberCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load campaigns';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const templateId = String(body.templateId || '').trim();
    const campaignName = String(body.campaignName || '').trim();
    const subscribers = String(body.subscribers || 'All Subscribers');
    const dailyLimit = Number(body.dailyLimit);

    if (!templateId || !campaignName || !Number.isFinite(dailyLimit)) {
      return NextResponse.json(
        { error: 'templateId, campaignName, and dailyLimit are required' },
        { status: 400 }
      );
    }

    const campaign = await createCampaign({
      companyId,
      templateId,
      campaignName,
      subscribers,
      dailyLimit,
      sendHour: body.sendHour !== undefined ? Number(body.sendHour) : undefined,
      sendMinute: body.sendMinute !== undefined ? Number(body.sendMinute) : undefined,
      sendTimezone: body.sendTimezone,
    });

    return NextResponse.json({
      campaignId: campaign.id,
      'campaign id': campaign.id,
      campaign_id: campaign.id,
      id: campaign.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create campaign';
    const status = message.includes('not configured') || message.includes('not found') ? 503 : 500;
    console.error('[newsletter/campaigns]', err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const campaign = await prisma.newsletterCampaign.updateMany({
      where: { id, companyId },
      data: {
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.dailyLimit !== undefined ? { dailyLimit: Number(body.dailyLimit) } : {}),
        ...(body.sendHour !== undefined ? { sendHour: Number(body.sendHour) } : {}),
        ...(body.sendMinute !== undefined ? { sendMinute: Number(body.sendMinute) } : {}),
        ...(body.sendTimezone !== undefined ? { sendTimezone: String(body.sendTimezone) } : {}),
      },
    });

    if (campaign.count === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const updated = await prisma.newsletterCampaign.findFirst({ where: { id, companyId } });
    return NextResponse.json({ campaign: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update campaign';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
