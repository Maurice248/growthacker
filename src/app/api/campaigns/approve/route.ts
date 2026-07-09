export const dynamic = 'force-dynamic';
export const maxDuration = 180;

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserId, getRequestCompanyId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendCampaign } from '@/lib/cold-email/campaign';

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = await getRequestCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: 'Company context required' }, { status: 403 });
    }

    const body = await req.json();
    const { campaignId, decision, comments } = body;

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    if (!decision || !['approved', 'rejected'].includes(decision.toLowerCase())) {
      return NextResponse.json(
        { error: 'decision must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { execution: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const inScope =
      (companyId && campaign.execution.companyId === companyId) ||
      campaign.execution.userId === userId;
    if (!inScope) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (campaign.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status}` },
        { status: 400 }
      );
    }

    if (decision.toLowerCase() === 'rejected') {
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'REJECTED',
          rejectedBy: userId,
          rejectedAt: new Date(),
          rejectionReason: comments || 'No reason provided',
        },
      });
      return NextResponse.json({ success: true, campaign: updated, message: 'Campaign rejected' });
    }

    let sendResult;
    try {
      sendResult = await sendCampaign(companyId, campaignId, userId);
    } catch (err) {
      const isConfig = err instanceof Error && err.message.includes('not configured');
      const message = err instanceof Error ? err.message : 'Approval send failed';
      return NextResponse.json({ error: message }, { status: isConfig ? 503 : 500 });
    }

    if (sendResult.status === 'no_leads_available') {
      return NextResponse.json({
        success: false,
        status: 'no_leads_available',
        message: sendResult.message,
        breakdown: sendResult.breakdown,
        action_required: true,
        action: 'SCRAPE_NEW_LEADS',
      });
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        comments: comments || null,
        totalLeadsSent: sendResult.total_sent ?? 0,
        successfulSends: sendResult.total_sent ?? 0,
        failedSends: sendResult.failed ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      campaign: updated,
      result: {
        status: 'success',
        message: sendResult.message,
        total_sent: sendResult.total_sent,
        emails_sent: sendResult.emails_sent,
        failed: sendResult.failed,
      },
      message: sendResult.message,
    });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
