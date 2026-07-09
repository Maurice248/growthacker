export const dynamic = 'force-dynamic';
export const maxDuration = 180;

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserId, getRequestCompanyId } from '@/lib/auth';
import { executionRelationWhere } from '@/lib/workflow-scope';
import { prisma } from '@/lib/prisma';
import { generateCampaignContent } from '@/lib/cold-email/campaign';
import { resolveLeadListId } from '@/lib/cold-email/config';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

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

    const requiredFields = [
      'campaign_name',
      'service_type',
      'target_region',
      'campaign_goal',
      'campaign_message',
      'cta_button_text',
      'tone',
      'selected_sheet',
    ];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const listRef = await resolveLeadListId(
      companyId,
      body.lead_list_id || body.selected_sheet
    );
    if (!listRef) {
      return NextResponse.json(
        { error: `Lead list not found: "${body.selected_sheet}". Create a list in Cold Email settings.` },
        { status: 400 }
      );
    }

    let generated;
    try {
      generated = await generateCampaignContent(companyId, {
        ...body,
        selected_sheet: listRef.name,
        lead_list_id: listRef.id,
      });
    } catch (err) {
      const isConfig = err instanceof Error && err.message.includes('not configured');
      const message = err instanceof Error ? err.message : 'Campaign generation failed';
      return NextResponse.json({ error: message }, { status: isConfig ? 503 : 400 });
    }

    const duration = Date.now() - startTime;
    const workflowData = {
      status: 'pending_approval',
      execution_id: generated.executionId,
      workflow_type: 'campaign',
      message: 'Campaign created successfully. AI content generated. Awaiting approval.',
      campaign_preview: generated.preview,
      sheet_info: {
        sheet_tab: listRef.name,
        sheet_url: '',
        sheet_gid: listRef.id,
      },
      approval_required: true,
      approval_endpoint: '/api/campaigns/approve',
    };

    const execution = await prisma.workflowExecution.create({
      data: {
        userId,
        companyId,
        workflowType: 'CAMPAIGN',
        workflowName: body.campaign_name,
        status: 'SUCCESS',
        externalExecutionId: generated.executionId,
        inputData: JSON.stringify(body),
        outputData: JSON.stringify(workflowData),
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        executionId: execution.id,
        campaignName: body.campaign_name,
        serviceType: body.service_type,
        targetRegion: body.target_region,
        campaignGoal: body.campaign_goal,
        campaignMessage: body.campaign_message,
        selectedSheet: listRef.name,
        leadListId: listRef.id,
        aiGeneratedContent: JSON.stringify(generated.preview),
        status: 'PENDING_APPROVAL',
        createdBy: userId,
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        campaignName: campaign.campaignName,
        status: campaign.status,
        preview: generated.preview,
        sheetInfo: workflowData.sheet_info,
      },
      message: workflowData.message,
    });
  } catch (error) {
    console.error('Campaign POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = await getRequestCompanyId();
    const scope = executionRelationWhere(companyId, userId);

    const campaigns = await prisma.campaign.findMany({
      where: { execution: scope },
      include: {
        execution: {
          select: { status: true, createdAt: true, duration: true, outputData: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = campaigns.map((c) => ({
      ...c,
      aiGeneratedContent: c.aiGeneratedContent ? JSON.parse(c.aiGeneratedContent) : null,
    }));

    return NextResponse.json({ campaigns: parsed });
  } catch (error) {
    console.error('Campaign GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
