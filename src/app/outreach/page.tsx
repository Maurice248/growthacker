import { Header } from '@/components/dashboard/header';
import { RecentExecutions, type ExecutionItem } from '@/components/dashboard/recent-executions';
import { PageBody } from '@/components/outreach/page-body';
import {
  EditorialStatCell,
  EditorialStatRibbon,
  OutreachCampaignBarChart,
  OutreachLeadBarChart,
} from '@/components/cold-email/outreach-ui';
import { SECTION_CONFIG } from '@/lib/app-section-config';
import { requireServerSession } from '@/lib/server-auth';
import { getOutreachDashboardData } from '@/lib/dashboard-data';
import { AlertCircle } from 'lucide-react';

const labels = SECTION_CONFIG.outreach.labels;

export default async function OutreachDashboardPage() {
  const session = await requireServerSession();
  const userId = session.user.id;
  const companyId = session.user.companyId ?? null;

  const stats = await getOutreachDashboardData(companyId, userId);

  const executions: ExecutionItem[] = stats.recentExecutions.map((exec) => ({
    id: exec.id,
    workflowType: exec.workflowType,
    workflowName: exec.workflowName,
    status: exec.status,
    createdAt: exec.createdAt,
    campaignId: exec.campaign?.id ?? null,
  }));

  return (
    <div>
      <Header title="Dashboard" description="Overview of your automation workflows." />

      <PageBody className="space-y-12">
        {stats.dbUnavailable && (
          <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Cold Email database not set up yet</p>
              <p className="mt-1 text-amber-800">
                Run{' '}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                  npx prisma db execute --file prisma/migrations/add_outreach_tables.sql
                </code>{' '}
                to create the outreach tables, then refresh.
              </p>
            </div>
          </div>
        )}

        <EditorialStatRibbon columns={3}>
          <EditorialStatCell
            isFirst
            value={stats.totalCampaigns}
            label="Email templates"
            sub="AI-generated campaigns"
          />
          <EditorialStatCell
            value={stats.totalLeadsScraped.toLocaleString()}
            label="Leads scraped"
            sub={`${stats.validLeads.toLocaleString()} valid emails`}
          />
          <EditorialStatCell
            isLast
            value={`${stats.successRate}%`}
            label={labels.successRateTitle}
            sub="Across all workflows"
            accent="danger"
          />
        </EditorialStatRibbon>

        <section className="grid grid-cols-1 gap-12 xl:grid-cols-[1.5fr_1fr]">
          <OutreachCampaignBarChart data={stats.campaignsByMonth} />
          {stats.leadsBySheet.length > 0 ? (
            <OutreachLeadBarChart data={stats.leadsBySheet} title={labels.leadsByChartTitle} />
          ) : (
            <div>
              <OutreachLeadBarChart
                data={[{ sheet: 'No data yet', count: 0 }]}
                title={labels.leadsByChartTitle}
              />
              <p className="mt-4 text-[13px] text-[var(--text-muted)]">
                Run a scraper to populate lead lists.
              </p>
            </div>
          )}
        </section>

        <RecentExecutions initialExecutions={executions} />
      </PageBody>
    </div>
  );
}
