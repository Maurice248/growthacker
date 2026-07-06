import { Header } from '@/components/dashboard/header';
import { StatsCard } from '@/components/dashboard/stats-card';
import { RecentExecutions, type ExecutionItem } from '@/components/dashboard/recent-executions';
import { CampaignChart } from '@/components/analytics/campaign-chart';
import { LeadChart } from '@/components/analytics/lead-chart';
import { PageBody } from '@/components/outreach/page-body';
import { SECTION_CONFIG } from '@/lib/app-section-config';
import { requireServerSession } from '@/lib/server-auth';
import { getOutreachDashboardData } from '@/lib/dashboard-data';
import { Mail, Search, TrendingUp, AlertCircle } from 'lucide-react';

const labels = SECTION_CONFIG.outreach.labels;
const basePath = SECTION_CONFIG.outreach.basePath;

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
      <Header title="Dashboard" description="Overview of your automation workflows" />

      <PageBody>
        {stats.dbUnavailable && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Cold Email database not set up yet</p>
              <p className="mt-1 text-amber-800">
                Run <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">npx prisma db execute --file prisma/migrations/add_outreach_tables.sql</code> to
                create the outreach tables, then refresh.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <StatsCard
            title={labels.totalCampaignsTitle}
            value={stats.totalCampaigns}
            subtitle="AI-generated email campaigns"
            icon={Mail}
            variant="outreach"
          />
          <StatsCard
            title="Leads Scraped"
            value={stats.totalLeadsScraped.toLocaleString()}
            subtitle={`${stats.validLeads.toLocaleString()} valid emails`}
            icon={Search}
            variant="outreach"
          />
          <StatsCard
            title={labels.successRateTitle}
            value={`${stats.successRate}%`}
            subtitle="Across all workflows"
            icon={TrendingUp}
            variant="outreach"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <CampaignChart data={stats.campaignsByMonth} />
          {stats.leadsBySheet.length > 0 ? (
            <LeadChart data={stats.leadsBySheet} title={labels.leadsByChartTitle} />
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-white p-12 text-gray-400 shadow-sm">
              <p className="text-sm">No lead data yet. Run a scraper to see charts.</p>
            </div>
          )}
        </div>

        <RecentExecutions initialExecutions={executions} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[
            {
              href: `${basePath}/campaigns/new`,
              icon: Mail,
              title: 'New Campaign',
              desc: 'AI-generate & send emails',
              color: 'bg-blue-50 border-blue-200',
            },
            {
              href: `${basePath}/scraper`,
              icon: Search,
              title: 'Scrape Leads',
              desc: 'Find leads on Google Maps',
              color: 'bg-green-50 border-green-200',
            },
          ].map(({ href, icon: Icon, title, desc, color }) => (
            <a
              key={href}
              href={href}
              className={`flex items-center gap-4 rounded-xl border-2 p-5 transition-all hover:shadow-md ${color}`}
            >
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <Icon className="h-6 w-6 text-[#0077b6]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
