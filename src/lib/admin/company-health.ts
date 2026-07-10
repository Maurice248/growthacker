import { prisma } from '@/lib/prisma';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import { fetchAdminOperations } from '@/lib/admin/operations';

export type HealthFactor = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type CompanySupportSnapshot = {
  lastWorkflowAt: string | null;
  recentErrorCount: number;
  activeNewsletterCampaigns: number;
  activeOutreachCampaigns: number;
  subscriberCount: number;
  leadCount: number;
  socialJobCount: number;
  blogJobCount: number;
  lastNewsletterRunAt: string | null;
  lastBlogRunAt: string | null;
};

export type CompanyHealthResult = {
  score: number;
  factors: HealthFactor[];
  support: CompanySupportSnapshot;
};

const STALE_DAYS = 14;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export async function computeCompanyHealth(companyId: string): Promise<CompanyHealthResult> {
  const [
    company,
    userCount,
    integrationStatus,
    newsletterConfig,
    outreachConfig,
    blogConfig,
    recentExecutions,
    recentErrors,
    activeNewsletterCampaigns,
    pendingCampaigns,
    subscriberCount,
    leadCount,
    socialJobCount,
    blogJobCount,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        onboardingCompletedAt: true,
        brandConfig: { select: { id: true } },
      },
    }),
    prisma.user.count({ where: { companyId } }),
    getCompanyIntegrationStatus(companyId),
    prisma.newsletterConfig.findUnique({
      where: { companyId },
      select: { active: true, updatedAt: true },
    }),
    prisma.outreachConfig.findUnique({
      where: { companyId },
      select: { active: true, updatedAt: true },
    }),
    prisma.blogConfig.findUnique({
      where: { companyId },
      select: { active: true, lastRunAt: true },
    }),
    prisma.workflowExecution.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true },
    }),
    fetchAdminOperations({ companyId, limit: 50 }).then((events) =>
      events.filter((e) => e.normalizedStatus === 'failed').slice(0, 10)
    ),
    prisma.newsletterCampaign.count({ where: { companyId, status: 'active' } }),
    prisma.campaign.count({
      where: {
        execution: { companyId },
        status: { in: ['PENDING_APPROVAL', 'pending_approval'] },
      },
    }),
    prisma.newsletterSubscriber.count({ where: { companyId, status: 'subscribed' } }),
    prisma.outreachLead.count({ where: { companyId } }),
    prisma.socialStudioJob.count({ where: { companyId } }),
    prisma.blogJob.count({ where: { companyId } }),
  ]);

  const configuredModules = integrationStatus.modules.filter((m) => m.configured).length;
  const totalModules = integrationStatus.modules.length;

  const lastNewsletterRun = await prisma.newsletterCampaign.findFirst({
    where: { companyId },
    orderBy: { lastRunAt: 'desc' },
    select: { lastRunAt: true },
  });

  const factors: HealthFactor[] = [
    {
      id: 'onboarding',
      label: 'Onboarding complete',
      ok: Boolean(company?.onboardingCompletedAt),
    },
    {
      id: 'integrations',
      label: 'Integrations configured',
      ok: integrationStatus.configured,
      detail: integrationStatus.configured
        ? `${configuredModules}/${totalModules} modules ready`
        : 'Missing API keys or credentials',
    },
    {
      id: 'brand',
      label: 'Brand config present',
      ok: Boolean(company?.brandConfig),
    },
    {
      id: 'users',
      label: 'Has team members',
      ok: userCount > 0,
      detail: `${userCount} user(s)`,
    },
    {
      id: 'workflows',
      label: 'Recent workflow activity',
      ok: Boolean(recentExecutions),
      detail: recentExecutions
        ? `Last run ${recentExecutions.createdAt.toISOString().slice(0, 10)}`
        : 'No workflows yet',
    },
    {
      id: 'errors',
      label: 'No recent failures',
      ok: recentErrors.length === 0,
      detail:
        recentErrors.length > 0 ? `${recentErrors.length} failed job(s) in recent history` : undefined,
    },
    {
      id: 'newsletter_active',
      label: 'Newsletter config active',
      ok: !newsletterConfig || newsletterConfig.active,
      detail: newsletterConfig ? (newsletterConfig.active ? 'Active' : 'Paused') : 'Not configured',
    },
    {
      id: 'outreach_active',
      label: 'Outreach config active',
      ok: !outreachConfig || outreachConfig.active,
      detail: outreachConfig ? (outreachConfig.active ? 'Active' : 'Paused') : 'Not configured',
    },
    {
      id: 'blog_schedule',
      label: 'Blog schedule fresh',
      ok: !blogConfig?.active
        ? true
        : Boolean(
            blogConfig.lastRunAt &&
              (daysSince(blogConfig.lastRunAt.toISOString()) ?? 999) <= STALE_DAYS
          ),
      detail: blogConfig?.lastRunAt
        ? `Last run ${blogConfig.lastRunAt.toISOString().slice(0, 10)}`
        : blogConfig?.active
          ? 'Never run'
          : 'Not active',
    },
  ];

  const weights = [12, 18, 12, 10, 15, 15, 6, 6, 6];
  const score = Math.round(
    factors.reduce((sum, f, i) => sum + (f.ok ? weights[i] : 0), 0)
  );

  return {
    score,
    factors,
    support: {
      lastWorkflowAt: recentExecutions?.createdAt.toISOString() ?? null,
      recentErrorCount: recentErrors.length,
      activeNewsletterCampaigns,
      activeOutreachCampaigns: pendingCampaigns,
      subscriberCount,
      leadCount,
      socialJobCount,
      blogJobCount,
      lastNewsletterRunAt: lastNewsletterRun?.lastRunAt?.toISOString() ?? null,
      lastBlogRunAt: blogConfig?.lastRunAt?.toISOString() ?? null,
    },
  };
}
