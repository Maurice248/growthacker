import { prisma } from '@/lib/prisma';
import { getOutreachDashboardData } from '@/lib/dashboard-data';
import type { ModuleId } from '@/lib/company-module-status';

export type ModuleOverviewStat = {
  label: string;
  value: string | number;
};

export type ModuleOverview = {
  stats: ModuleOverviewStat[];
  highlight?: string;
};

export type HomeDashboardOverviews = Partial<Record<ModuleId, ModuleOverview>>;

function formatRelativeDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function getMetaOverview(companyId: string): Promise<ModuleOverview> {
  const [totalAutomations, activeAutomations, variantCount, latest] = await Promise.all([
    prisma.adAutomation.count({ where: { companyId } }),
    prisma.adAutomation.count({ where: { companyId, automationEnabled: true } }),
    prisma.adVariant.count({ where: { automation: { companyId } } }),
    prisma.adAutomation.findFirst({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      select: { status: true, updatedAt: true },
    }),
  ]);

  const lastActivity = formatRelativeDate(latest?.updatedAt);
  return {
    stats: [
      { label: 'Automations', value: totalAutomations },
      { label: 'Running', value: activeAutomations },
      { label: 'Ad variants', value: variantCount },
    ],
    highlight: lastActivity
      ? `Last activity ${lastActivity}${latest?.status ? ` · ${latest.status.replace(/_/g, ' ')}` : ''}`
      : totalAutomations === 0
        ? 'No automated campaigns yet'
        : undefined,
  };
}

async function getSocialOverview(companyId: string): Promise<ModuleOverview> {
  const [totalJobs, postedJobs, failedJobs, latest] = await Promise.all([
    prisma.socialStudioJob.count({ where: { companyId } }),
    prisma.socialStudioJob.count({ where: { companyId, assetUrl: { not: null } } }),
    prisma.socialStudioJob.count({ where: { companyId, error: { not: null } } }),
    prisma.socialStudioJob.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { kind: true, status: true, createdAt: true },
    }),
  ]);

  const lastActivity = formatRelativeDate(latest?.createdAt);
  return {
    stats: [
      { label: 'Total jobs', value: totalJobs },
      { label: 'Published', value: postedJobs },
      { label: 'Failed', value: failedJobs },
    ],
    highlight: lastActivity
      ? `Latest ${latest?.kind ?? 'job'} ${lastActivity}${latest?.status ? ` · ${latest.status}` : ''}`
      : totalJobs === 0
        ? 'No content generated yet'
        : undefined,
  };
}

async function getOutreachOverview(
  companyId: string,
  userId: string
): Promise<ModuleOverview> {
  const [data, leadLists] = await Promise.all([
    getOutreachDashboardData(companyId, userId),
    prisma.outreachLeadList.count({ where: { companyId } }),
  ]);

  return {
    stats: [
      { label: 'Email templates', value: data.totalCampaigns },
      { label: 'Valid leads', value: data.validLeads.toLocaleString() },
      { label: 'Lead lists', value: leadLists },
    ],
    highlight:
      data.recentExecutions[0]
        ? `Last workflow ${formatRelativeDate(data.recentExecutions[0].createdAt) ?? 'recently'}`
        : data.totalLeadsScraped === 0
          ? 'No leads scraped yet'
          : `${data.totalLeadsScraped.toLocaleString()} leads scraped total`,
  };
}

async function getNewsletterOverview(companyId: string): Promise<ModuleOverview> {
  const [subscribers, activeCampaigns, emailsSent, latestSend] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { companyId, status: 'subscribed' } }),
    prisma.newsletterCampaign.count({ where: { companyId, status: 'active' } }),
    prisma.newsletterSend.count({ where: { campaign: { companyId } } }),
    prisma.newsletterSend.findFirst({
      where: { campaign: { companyId } },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }),
  ]);

  const lastActivity = formatRelativeDate(latestSend?.sentAt);
  return {
    stats: [
      { label: 'Subscribers', value: subscribers.toLocaleString() },
      { label: 'Active campaigns', value: activeCampaigns },
      { label: 'Emails sent', value: emailsSent.toLocaleString() },
    ],
    highlight: lastActivity
      ? `Last send ${lastActivity}`
      : subscribers === 0
        ? 'No subscribers yet'
        : 'No sends recorded yet',
  };
}

async function getBlogOverview(companyId: string): Promise<ModuleOverview> {
  const [published, inProgress, activeCategories, latest] = await Promise.all([
    prisma.blogJob.count({ where: { companyId, status: 'done' } }),
    prisma.blogJob.count({ where: { companyId, status: { notIn: ['done', 'error'] } } }),
    prisma.blogCategory.count({ where: { companyId, active: true } }),
    prisma.blogJob.findFirst({
      where: { companyId, status: 'done' },
      orderBy: { updatedAt: 'desc' },
      select: { title: true, updatedAt: true },
    }),
  ]);

  const lastActivity = formatRelativeDate(latest?.updatedAt);
  return {
    stats: [
      { label: 'Posts published', value: published },
      { label: 'In progress', value: inProgress },
      { label: 'Active categories', value: activeCategories },
    ],
    highlight: lastActivity
      ? `Latest post ${lastActivity}${latest?.title ? ` · ${latest.title}` : ''}`
      : published === 0
        ? 'No posts published yet'
        : undefined,
  };
}

export async function getHomeDashboardOverviews(
  companyId: string | null,
  userId: string
): Promise<HomeDashboardOverviews> {
  if (!companyId) return {};

  const [meta, social, outreach, newsletter, blog] = await Promise.all([
    getMetaOverview(companyId).catch(() => null),
    getSocialOverview(companyId).catch(() => null),
    getOutreachOverview(companyId, userId).catch(() => null),
    getNewsletterOverview(companyId).catch(() => null),
    getBlogOverview(companyId).catch(() => null),
  ]);

  const result: HomeDashboardOverviews = {};
  if (meta) result.meta = meta;
  if (social) result.social = social;
  if (outreach) result.outreach = outreach;
  if (newsletter) result.newsletter = newsletter;
  if (blog) result.blog = blog;
  return result;
}
