import { prisma } from '@/lib/prisma';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';

export type OnboardingBlocker =
  | 'onboarding_incomplete'
  | 'no_integrations'
  | 'no_brand_config'
  | 'no_users'
  | 'no_successful_workflow';

export type OnboardingQueueRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  blockers: OnboardingBlocker[];
  userCount: number;
  integrationsConfigured: boolean;
};

export async function fetchOnboardingQueue(): Promise<OnboardingQueueRow[]> {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true } },
      brandConfig: { select: { id: true } },
    },
  });

  const rows: OnboardingQueueRow[] = [];

  for (const c of companies) {
    const { configured } = await getCompanyIntegrationStatus(c.id);

    const hasSuccess = await prisma.workflowExecution.findFirst({
      where: { companyId: c.id, status: 'SUCCESS' },
      select: { id: true },
    });

    const blockers: OnboardingBlocker[] = [];
    if (!c.onboardingCompletedAt) blockers.push('onboarding_incomplete');
    if (!configured) blockers.push('no_integrations');
    if (!c.brandConfig) blockers.push('no_brand_config');
    if (c._count.users === 0) blockers.push('no_users');
    if (!hasSuccess) blockers.push('no_successful_workflow');

    if (blockers.length > 0) {
      rows.push({
        id: c.id,
        name: c.name,
        slug: c.slug,
        createdAt: c.createdAt.toISOString(),
        blockers,
        userCount: c._count.users,
        integrationsConfigured: configured,
      });
    }
  }

  return rows;
}

export type UsageWindow = '7d' | '30d';

function windowStart(window: UsageWindow): Date {
  const days = window === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export type UsageMetrics = {
  window: UsageWindow;
  platform: {
    newslettersSent: number;
    leadsScraped: number;
    outreachLeads: number;
    emailsPushed: number;
    socialJobs: number;
    blogJobsCompleted: number;
    workflowFailures: number;
  };
  byCompany: Array<{
    companyId: string;
    companyName: string;
    newslettersSent: number;
    leadsScraped: number;
    outreachLeads: number;
    emailsPushed: number;
    socialJobs: number;
    blogJobsCompleted: number;
    totalActivity: number;
  }>;
};

export async function fetchUsageMetrics(window: UsageWindow): Promise<UsageMetrics> {
  const since = windowStart(window);

  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const [
    newsletterSends,
    scraperAgg,
    outreachLeadCount,
    emailAgg,
    socialCount,
    blogDone,
    workflowFailures,
  ] = await Promise.all([
    prisma.newsletterSend.count({ where: { sentAt: { gte: since } } }),
    prisma.scraperJob.aggregate({
      where: { execution: { createdAt: { gte: since } } },
      _sum: { totalScraped: true },
    }),
    prisma.outreachLead.count({ where: { createdAt: { gte: since } } }),
    prisma.campaign.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { totalLeadsSent: true },
    }),
    prisma.socialStudioJob.count({ where: { createdAt: { gte: since } } }),
    prisma.blogJob.count({ where: { createdAt: { gte: since }, status: 'done' } }),
    prisma.workflowExecution.count({
      where: { createdAt: { gte: since }, status: 'FAILED' },
    }),
  ]);

  const byCompany = await Promise.all(
    companies.map(async (c) => {
      const [newslettersSent, scraper, outreachLeads, emails, socialJobs, blogJobsCompleted] =
        await Promise.all([
          prisma.newsletterSend.count({
            where: { sentAt: { gte: since }, campaign: { companyId: c.id } },
          }),
          prisma.scraperJob.aggregate({
            where: { execution: { companyId: c.id, createdAt: { gte: since } } },
            _sum: { totalScraped: true },
          }),
          prisma.outreachLead.count({ where: { companyId: c.id, createdAt: { gte: since } } }),
          prisma.campaign.aggregate({
            where: { execution: { companyId: c.id }, createdAt: { gte: since } },
            _sum: { totalLeadsSent: true },
          }),
          prisma.socialStudioJob.count({ where: { companyId: c.id, createdAt: { gte: since } } }),
          prisma.blogJob.count({
            where: { companyId: c.id, createdAt: { gte: since }, status: 'done' },
          }),
        ]);

      const row = {
        companyId: c.id,
        companyName: c.name,
        newslettersSent,
        leadsScraped: scraper._sum.totalScraped ?? 0,
        outreachLeads,
        emailsPushed: emails._sum.totalLeadsSent ?? 0,
        socialJobs,
        blogJobsCompleted,
        totalActivity: 0,
      };
      row.totalActivity =
        row.newslettersSent +
        row.leadsScraped +
        row.outreachLeads +
        row.emailsPushed +
        row.socialJobs +
        row.blogJobsCompleted;
      return row;
    })
  );

  byCompany.sort((a, b) => b.totalActivity - a.totalActivity);

  return {
    window,
    platform: {
      newslettersSent: newsletterSends,
      leadsScraped: scraperAgg._sum.totalScraped ?? 0,
      outreachLeads: outreachLeadCount,
      emailsPushed: emailAgg._sum.totalLeadsSent ?? 0,
      socialJobs: socialCount,
      blogJobsCompleted: blogDone,
      workflowFailures,
    },
    byCompany,
  };
}

export type DiagnosticsRow = {
  companyId: string;
  companyName: string;
  slug: string;
  integrationsConfigured: boolean;
  modules: Array<{
    id: string;
    label: string;
    configured: boolean;
    missingKeys: string[];
  }>;
  missingCount: number;
};

export async function fetchIntegrationDiagnostics(): Promise<DiagnosticsRow[]> {
  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  const rows: DiagnosticsRow[] = [];

  for (const c of companies) {
    const { configured, modules } = await getCompanyIntegrationStatus(c.id);
    const missingCount = modules.filter((m) => !m.configured).length;
    rows.push({
      companyId: c.id,
      companyName: c.name,
      slug: c.slug,
      integrationsConfigured: configured,
      modules: modules.map((m) => ({
        id: m.id,
        label: m.label,
        configured: m.configured,
        missingKeys: m.missingKeys,
      })),
      missingCount,
    });
  }

  return rows;
}
