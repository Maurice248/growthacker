'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Megaphone,
  Newspaper,
  Send,
  Share2,
  AlertCircle,
} from 'lucide-react';
import {
  EditorialPageHeader,
  EditorialStatCell,
  EditorialStatRibbon,
} from '@/components/editorial/editorial-layout';
import { EditorialShellGutter } from '@/components/editorial/editorial-shell-gutter';
import { EditorialPageShell } from '@/components/outreach/page-body';
import {
  CLIENT_MODULE_ENTRY_TABS,
  clientWorkspaceHref,
} from '@/lib/client-dashboard-nav';
import {
  INTEGRATION_MODULE_IDS,
  type ModuleId,
  type ModuleStatus,
} from '@/lib/company-module-status';
import type { HomeDashboardOverviews, ModuleOverview } from '@/lib/home-dashboard-data';
import { useModuleStatuses } from '@/components/client-dashboard/module-status-context';

type HomeDashboardProps = {
  userName: string;
  overviews: HomeDashboardOverviews;
};

const MODULE_ICONS: Record<ModuleId, React.ComponentType<{ size?: number; className?: string }>> = {
  meta: Megaphone,
  social: Share2,
  outreach: Send,
  newsletter: Newspaper,
  blog: FileText,
  coldDm: Send,
  coldCall: Send,
  coldSms: Send,
};

const MODULE_DESCRIPTIONS: Partial<Record<ModuleId, string>> = {
  meta: 'Create, launch, and monitor Meta advertising campaigns.',
  social: 'Generate images and video, then publish across social channels.',
  outreach: 'Scrape leads, generate cold emails, and track outreach performance.',
  newsletter: 'Generate newsletters, manage subscribers, and run email campaigns.',
  blog: 'Write blog posts and automate WordPress publishing.',
};

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function ModuleStatGrid({ overview }: { overview: ModuleOverview }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4">
      {overview.stats.map((stat) => (
        <div key={stat.label}>
          <div className="font-[family-name:var(--font-display)] text-xl font-bold leading-none text-[var(--primary)]">
            {stat.value}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModuleCard({
  module,
  overview,
}: {
  module: ModuleStatus;
  overview?: ModuleOverview;
}) {
  const Icon = MODULE_ICONS[module.id] ?? Megaphone;
  const entryTab = CLIENT_MODULE_ENTRY_TABS[module.id];
  const href = module.configured && entryTab
    ? clientWorkspaceHref(entryTab)
    : '/client-dashboard/apis';
  const description = MODULE_DESCRIPTIONS[module.id] ?? 'Open this module in your workspace.';

  return (
    <article className="flex flex-col border border-[var(--border)] bg-[var(--card-bg)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(26,74,102,0.08)] text-[var(--primary)]">
          <Icon size={18} />
        </div>
        {module.configured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            <CheckCircle2 size={12} />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            <AlertCircle size={12} />
            Setup needed
          </span>
        )}
      </div>

      <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text)]">
        {module.label}
      </h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#4A5A64]">{description}</p>

      {module.configured && overview ? (
        <>
          <ModuleStatGrid overview={overview} />
          {overview.highlight && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              {overview.highlight}
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <p className="text-[12.5px] leading-relaxed text-amber-900">
            {module.missingKeys.length > 0
              ? `Needs: ${module.missingKeys.slice(0, 2).join(', ')}${module.missingKeys.length > 2 ? '…' : ''}`
              : 'Connect API keys in Settings to unlock this module.'}
          </p>
        </div>
      )}

      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 self-start text-[13px] font-bold text-[var(--primary)] hover:text-[var(--red)]"
      >
        {module.configured ? 'View module' : 'Configure keys'}
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

export function HomeDashboard({ userName, overviews }: HomeDashboardProps) {
  const moduleStatuses = useModuleStatuses();
  const greeting = getTimeGreeting();

  const activeModules = moduleStatuses.filter(
    (m) => INTEGRATION_MODULE_IDS.includes(m.id) && m.enabled
  );
  const configuredCount = activeModules.filter((m) => m.configured).length;
  const setupNeededCount = activeModules.length - configuredCount;

  return (
    <EditorialShellGutter as="div" className="min-h-[calc(100dvh)]">
      <EditorialPageShell>
        <EditorialPageHeader
          title={
            <>
              {greeting}, {userName}
            </>
          }
          subtitle="Your command center for growth automation. See a snapshot of each active module below — campaigns, content, leads, and sends — without leaving the dashboard."
        />

        <EditorialStatRibbon columns={3} className="mb-12">
          <EditorialStatCell
            isFirst
            value={activeModules.length}
            label="Active modules"
            sub="Enabled for your workspace"
          />
          <EditorialStatCell
            value={configuredCount}
            label="Ready to use"
            sub="Fully configured and unlocked"
          />
          <EditorialStatCell
            isLast
            value={setupNeededCount}
            label="Needs setup"
            sub={setupNeededCount === 0 ? 'All modules configured' : 'Connect API keys in Settings'}
            accent={setupNeededCount > 0 ? 'danger' : 'default'}
          />
        </EditorialStatRibbon>

        {activeModules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-bg)] px-8 py-12 text-center">
            <p className="text-[15px] font-medium text-[var(--text)]">No modules enabled yet</p>
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">
              Contact your administrator to enable workspace modules for your company.
            </p>
          </div>
        ) : (
          <section>
            <div className="mb-5 flex items-baseline justify-between border-b border-[var(--primary)] pb-3.5">
              <h2 className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--red)] font-[family-name:var(--font-display)]">
                Module overview
              </h2>
              <Link
                href="/client-dashboard/apis"
                className="text-[13px] font-semibold text-[var(--primary)] hover:text-[var(--red)]"
              >
                Manage API keys
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {activeModules.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  overview={overviews[module.id]}
                />
              ))}
            </div>
          </section>
        )}
      </EditorialPageShell>
    </EditorialShellGutter>
  );
}
