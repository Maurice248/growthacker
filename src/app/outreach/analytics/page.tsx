import { prisma } from '@/lib/prisma';
import { requireServerSession } from '@/lib/server-auth';
import { executionWhere, executionRelationWhere } from '@/lib/workflow-scope';
import { Header } from '@/components/dashboard/header';
import { CampaignChart } from '@/components/analytics/campaign-chart';
import { LeadChart } from '@/components/analytics/lead-chart';
import { SECTION_CONFIG } from '@/lib/app-section-config';
import { PageBody } from '@/components/outreach/page-body';
import {
  EditorialStatCell,
  EditorialStatRibbon,
} from '@/components/cold-email/outreach-ui';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const labels = SECTION_CONFIG.outreach.labels;

async function getAnalytics(companyId: string | null, userId: string) {
  const scope = executionRelationWhere(companyId, userId);
  const execScope = executionWhere(companyId, userId);
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    return { start: startOfMonth(date), end: endOfMonth(date), label: format(date, 'MMM') };
  });

  const campaignsByMonth = await Promise.all(
    months.map(async ({ start, end, label }) => {
      const [count, agg] = await Promise.all([
        prisma.campaign.count({
          where: {
            execution: scope,
            createdAt: { gte: start, lte: end },
          },
        }),
        prisma.campaign.aggregate({
          where: {
            execution: scope,
            createdAt: { gte: start, lte: end },
          },
          _sum: { totalLeadsSent: true },
        }),
      ]);
      return { month: label, count, sent: agg._sum.totalLeadsSent ?? 0 };
    })
  );

  const leadsBySheet = await prisma.scraperJob.groupBy({
    by: ['targetSheet'],
    where: { execution: scope },
    _sum: { validEmails: true },
  });

  const [totalCampaigns, totalLeads, totalDeleted, successRate] = await Promise.all([
    prisma.campaign.count({ where: { execution: scope } }),
    prisma.scraperJob.aggregate({
      where: { execution: scope },
      _sum: { validEmails: true },
    }),
    prisma.cleanupLog.aggregate({
      where: { execution: scope },
      _sum: { deletedCount: true },
    }),
    Promise.all([
      prisma.workflowExecution.count({ where: { ...execScope, status: 'SUCCESS' } }),
      prisma.workflowExecution.count({ where: execScope }),
    ]).then(([s, t]) => (t > 0 ? Math.round((s / t) * 100) : 0)),
  ]);

  return {
    totalCampaigns,
    totalLeads: totalLeads._sum.validEmails ?? 0,
    totalDeleted: totalDeleted._sum.deletedCount ?? 0,
    successRate,
    campaignsByMonth,
    leadsBySheet: leadsBySheet.map((r) => ({
      sheet: r.targetSheet,
      count: r._sum.validEmails ?? 0,
    })),
  };
}

export default async function OutreachAnalyticsPage() {
  const session = await requireServerSession();
  const userId = session.user.id;
  const companyId = session.user.companyId ?? null;

  const data = await getAnalytics(companyId, userId);

  return (
    <div>
      <Header title={labels.analyticsTitle} description={labels.analyticsDescription} />
      <PageBody>
        <EditorialStatRibbon columns={4}>
          <EditorialStatCell
            isFirst
            value={data.totalCampaigns}
            label="Templates · all time"
          />
          <EditorialStatCell
            value={data.totalLeads.toLocaleString()}
            label="Valid leads"
            accent="muted"
          />
          <EditorialStatCell
            value={data.totalDeleted.toLocaleString()}
            label="Contacts deleted"
            accent="muted"
          />
          <EditorialStatCell
            isLast
            value={`${data.successRate}%`}
            label="Success rate"
            accent="danger"
          />
        </EditorialStatRibbon>

        <div className="grid grid-cols-1 gap-12 xl:grid-cols-2">
          <CampaignChart data={data.campaignsByMonth} />
          {data.leadsBySheet.length > 0 ? (
            <LeadChart data={data.leadsBySheet} title={labels.leadsByChartTitle} />
          ) : (
            <div className="flex items-center justify-center border-t border-[var(--border)] py-12 text-[var(--text-muted)]">
              <p className="text-sm">No lead data yet. Run a scraper to see charts.</p>
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}
