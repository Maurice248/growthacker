import { prisma } from '@/lib/prisma';
import { chatCompletionJson } from '@/lib/social-studio/openai';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import { resolveOutreachContext } from './company-context';
import { resolveLeadListId } from './config';
import {
  buildCampaignSystemPrompt,
  buildCampaignUserPrompt,
  parseCampaignAiOutput,
  personalizeEmail,
  buildPlainTextOutreach,
} from './prompts';
import { pushLeadToInstantly } from './instantly';
import { getColdEmailTokens, requireToken } from './tokens';
import type { CampaignAiContent, CampaignGenerateInput } from './types';

export async function generateCampaignContent(
  companyId: string,
  input: CampaignGenerateInput
): Promise<{ preview: CampaignAiContent; executionId: string }> {
  const tokens = await getColdEmailTokens(companyId);
  const ai = await resolveModuleAi(companyId, 'outreach', tokens.openai);
  const ctx = await resolveOutreachContext(companyId);

  const raw = await chatCompletionJson(
    ai,
    [
      { role: 'system', content: buildCampaignSystemPrompt(ctx) },
      { role: 'user', content: buildCampaignUserPrompt(ctx, input) },
    ],
    { model: 'gpt-4o-mini', timeoutMs: 600_000 }
  );

  const parsed = parseCampaignAiOutput(JSON.stringify(raw));
  const bodyPreview = parsed.email_body.substring(0, 300) +
    (parsed.email_body.length > 300 ? '...' : '');

  const preview: CampaignAiContent = {
    campaign_name: input.campaign_name,
    service_type: input.service_type,
    subject_line: parsed.subject_line,
    preview_text: parsed.preview_text,
    header_title: parsed.header_title,
    greeting: parsed.greeting,
    opening: parsed.opening,
    main_content: parsed.main_content,
    cta: parsed.cta,
    closing: parsed.closing,
    footer_note: parsed.footer_note,
    full_email_body: parsed.email_body,
    body_preview: bodyPreview,
  };

  return {
    preview,
    executionId: crypto.randomUUID(),
  };
}

export type SendCampaignResult = {
  status: 'success' | 'no_leads_available' | 'error';
  message: string;
  total_sent?: number;
  failed?: number;
  emails_sent?: number;
  breakdown?: {
    total_leads_checked: number;
    missing_email: number;
    email_not_verified: number;
    already_sent: number;
  };
};

export async function sendCampaign(
  companyId: string,
  campaignId: string,
  userId: string
): Promise<SendCampaignResult> {
  const tokens = await getColdEmailTokens(companyId);
  const instantlyKey = requireToken(tokens, 'instantly', 'Instantly.ai');
  const ctx = await resolveOutreachContext(companyId);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { execution: true },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const instantlyCampaignId =
    campaign.instantlyCampaignId ||
    ctx.instantlyCampaignId;

  if (!instantlyCampaignId) {
    throw new Error(
      'Instantly campaign ID is not configured. Set it in Cold Email settings.'
    );
  }

  const listRef = campaign.leadListId
    ? await resolveLeadListId(companyId, campaign.leadListId)
    : await resolveLeadListId(companyId, campaign.selectedSheet);

  const allLeads = await prisma.outreachLead.findMany({
    where: {
      companyId,
      ...(listRef ? { listId: listRef.id } : {}),
    },
  });

  const eligible = allLeads.filter(
    (l) =>
      l.email &&
      l.email.includes('@') &&
      l.emailStatus === 'verified' &&
      l.sentStatus !== 'sent'
  );

  if (eligible.length === 0) {
    const noEmail = allLeads.filter((l) => !l.email).length;
    const notVerified = allLeads.filter((l) => l.emailStatus !== 'verified').length;
    const alreadySent = allLeads.filter((l) => l.sentStatus === 'sent').length;

    return {
      status: 'no_leads_available',
      message: 'There are no new verified leads available to send outreach messages.',
      breakdown: {
        total_leads_checked: allLeads.length,
        missing_email: noEmail,
        email_not_verified: notVerified,
        already_sent: alreadySent,
      },
    };
  }

  const aiContent = campaign.aiGeneratedContent
    ? (JSON.parse(campaign.aiGeneratedContent) as CampaignAiContent)
    : null;

  const subjectLine = aiContent?.subject_line || 'A thought worth sharing';
  const emailBody = aiContent?.full_email_body || '';
  const dailyLimit = ctx.dailySendLimit || 60;
  const toSend = eligible.slice(0, dailyLimit);

  let successful = 0;
  let failed = 0;

  for (const lead of toSend) {
    const personalizedBody = emailBody
      ? personalizeEmail(emailBody, {
          first_name: lead.firstName,
          last_name: lead.lastName,
          email: lead.email,
          city: lead.city,
          country: lead.country,
          service_type: campaign.serviceType,
        })
      : buildPlainTextOutreach(
          {
            first_name: lead.firstName,
            last_name: lead.lastName,
            email: lead.email,
            city: lead.city,
            country: lead.country,
          },
          subjectLine,
          ctx.companyName,
          ctx.destinationUrl
        );

    const result = await pushLeadToInstantly(instantlyKey, {
      campaign: instantlyCampaignId,
      email: lead.email,
      first_name: lead.firstName,
      last_name: lead.lastName,
      personalization: personalizedBody,
      custom_variables: {
        subject_line: subjectLine,
        city: lead.city,
      },
    });

    if (result.success) {
      successful++;
      await prisma.outreachLead.update({
        where: { id: lead.id },
        data: { sentStatus: 'sent', sentAt: new Date() },
      });
    } else {
      failed++;
      console.warn('[cold-email/send] Instantly push failed:', lead.email, result.error);
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      totalLeadsSent: successful,
      successfulSends: successful,
      failedSends: failed,
      instantlyCampaignId,
    },
  });

  await prisma.workflowExecution.create({
    data: {
      userId,
      companyId,
      workflowType: 'CAMPAIGN_APPROVAL',
      workflowName: `Approve: ${campaign.campaignName}`,
      status: successful > 0 ? 'SUCCESS' : 'FAILED',
      inputData: JSON.stringify({ campaignId, instantlyCampaignId }),
      outputData: JSON.stringify({ successful, failed }),
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return {
    status: 'success',
    message: `${successful} leads pushed to Instantly.ai campaign. Instantly will handle delivery and follow-ups.`,
    total_sent: successful,
    emails_sent: successful,
    failed,
  };
}
