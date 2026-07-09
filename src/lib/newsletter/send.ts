import { prisma } from '@/lib/prisma';
import { resolveNewsletterContext } from './company-context';
import { buildUnsubscribeUrl, renderNewsletterHtml } from './render';
import { getNewsletterTokens, requireToken } from './tokens';
import { shouldRunCampaignNow } from './timezones';

const SEND_DELAY_MS = 500;

function audienceLimitToNumber(limit: string): number | null {
  if (limit === 'All Subscribers') return null;
  const n = Number.parseInt(limit, 10);
  return Number.isFinite(n) ? n : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendResendEmail(params: {
  resendKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<string> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.resendKey}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resend returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = JSON.parse(text) as { id?: string };
  return data.id || '';
}

export async function getEligibleSubscribers(
  companyId: string,
  campaignId: string,
  audienceLimit: string,
  take: number
) {
  const maxAudience = audienceLimitToNumber(audienceLimit);

  const alreadySent = await prisma.newsletterSend.findMany({
    where: { campaignId },
    select: { subscriberId: true },
  });
  const sentIds = new Set(alreadySent.map((s) => s.subscriberId));

  if (maxAudience && sentIds.size >= maxAudience) {
    return [];
  }

  const remainingAudience = maxAudience ? maxAudience - sentIds.size : take;
  const limit = maxAudience ? Math.min(take, remainingAudience) : take;

  if (limit <= 0) return [];

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: {
      companyId,
      status: 'subscribed',
      emailStatus: 'verified',
      ...(sentIds.size > 0 ? { id: { notIn: Array.from(sentIds) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  return subscribers;
}

export async function runCampaignBatch(
  campaignId: string,
  options: { force?: boolean } = {}
): Promise<{ sent: number; completed: boolean; errors: string[] }> {
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });

  if (!campaign || campaign.status !== 'active') {
    return { sent: 0, completed: false, errors: ['Campaign not active'] };
  }

  if (
    !options.force &&
    !shouldRunCampaignNow(
      campaign.sendHour,
      campaign.sendMinute,
      campaign.sendTimezone,
      campaign.lastRunAt
    )
  ) {
    return { sent: 0, completed: false, errors: ['Not scheduled to run yet'] };
  }

  const ctx = await resolveNewsletterContext(campaign.companyId);
  if (!ctx.active) {
    return { sent: 0, completed: false, errors: ['Newsletter sending is disabled for this company'] };
  }

  const tokens = await getNewsletterTokens(campaign.companyId);
  const resendKey = requireToken(tokens, 'resend', 'Resend');
  const fromEmail = ctx.fromEmail;
  if (!fromEmail) {
    throw new Error('From email is not configured. Set it in Newsletter Settings.');
  }

  const from = ctx.fromName ? `${ctx.fromName} <${fromEmail}>` : fromEmail;
  const subscribers = await getEligibleSubscribers(
    campaign.companyId,
    campaign.id,
    campaign.audienceLimit,
    campaign.dailyLimit
  );

  if (subscribers.length === 0) {
    await prisma.newsletterCampaign.update({
      where: { id: campaign.id },
      data: { status: 'completed', lastRunAt: new Date() },
    });
    return { sent: 0, completed: true, errors: [] };
  }

  const errors: string[] = [];
  let sent = 0;

  for (const subscriber of subscribers) {
    try {
      const unsubscribeUrl = buildUnsubscribeUrl(ctx.unsubscribeBaseUrl, subscriber.unsubscribeToken);
      const html = renderNewsletterHtml(campaign.template.html, {
        first_name: subscriber.firstName,
        last_name: subscriber.lastName,
        email: subscriber.email,
        service_type: subscriber.serviceType || campaign.template.service,
        unsubscribe_token: subscriber.unsubscribeToken,
        unsubscribe_url: unsubscribeUrl,
      });

      const resendId = await sendResendEmail({
        resendKey,
        from,
        to: subscriber.email,
        subject: campaign.template.subjectLine,
        html,
        replyTo: ctx.replyTo || undefined,
      });

      await prisma.newsletterSend.create({
        data: {
          campaignId: campaign.id,
          subscriberId: subscriber.id,
          status: 'sent',
          resendId,
        },
      });

      sent += 1;
      if (SEND_DELAY_MS > 0) await sleep(SEND_DELAY_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      errors.push(`${subscriber.email}: ${message}`);
    }
  }

  const totalSent = campaign.sentCount + sent;
  const remaining = await getEligibleSubscribers(
    campaign.companyId,
    campaign.id,
    campaign.audienceLimit,
    1
  );

  await prisma.newsletterCampaign.update({
    where: { id: campaign.id },
    data: {
      sentCount: totalSent,
      lastRunAt: new Date(),
      ...(remaining.length === 0 ? { status: 'completed' } : {}),
    },
  });

  return { sent, completed: remaining.length === 0, errors };
}

export async function runAllActiveCampaigns(options: { force?: boolean } = {}) {
  const campaigns = await prisma.newsletterCampaign.findMany({
    where: { status: 'active' },
    select: { id: true },
  });

  const results = [];
  for (const campaign of campaigns) {
    const result = await runCampaignBatch(campaign.id, options);
    results.push({ campaignId: campaign.id, ...result });
  }

  return results;
}

export async function createCampaign(params: {
  companyId: string;
  templateId: string;
  campaignName: string;
  subscribers: string;
  dailyLimit: number;
  sendHour?: number;
  sendMinute?: number;
  sendTimezone?: string;
}) {
  const config = await resolveNewsletterContext(params.companyId);
  const template = await prisma.newsletterTemplate.findFirst({
    where: { id: params.templateId, companyId: params.companyId },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const campaign = await prisma.newsletterCampaign.create({
    data: {
      companyId: params.companyId,
      name: params.campaignName,
      templateId: params.templateId,
      dailyLimit: params.dailyLimit,
      audienceLimit: params.subscribers,
      sendHour: params.sendHour ?? config.sendHour,
      sendMinute: params.sendMinute ?? config.sendMinute,
      sendTimezone: params.sendTimezone ?? config.sendTimezone,
      status: 'active',
    },
  });

  return campaign;
}

export async function getCampaignsSummary(companyId: string) {
  const [campaigns, subscriberCount] = await Promise.all([
    prisma.newsletterCampaign.findMany({
      where: { companyId, status: 'active' },
      include: { template: { select: { subjectLine: true, id: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.newsletterSubscriber.count({
      where: { companyId, status: 'subscribed', emailStatus: 'verified' },
    }),
  ]);

  return {
    campaigns: campaigns.map((c) => ({
      id: c.id,
      template_id: c.templateId,
      subject_line: c.template.subjectLine,
      limit_for_daily: c.dailyLimit,
      audience_limit: c.audienceLimit,
      sent_count: c.sentCount,
      send_hour: c.sendHour,
      send_minute: c.sendMinute,
      send_timezone: c.sendTimezone,
      name: c.name,
      status: c.status,
    })),
    subscriberCount,
  };
}
