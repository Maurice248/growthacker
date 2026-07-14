'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Loader2,
  Plug,
  PlugZap,
  UserPlus,
  Users,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { RoleBadge } from '@/components/admin/role-badge';
import { cn } from '@/lib/utils';

type StatsResponse = {
  stats: {
    companyCount: number;
    userCount: number;
    appAdminCount: number;
    companyAdminCount: number;
    memberCount: number;
    companiesWithIntegrations: number;
    companiesWithoutIntegrations: number;
  };
  recentUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    companyName: string | null;
    createdAt: string;
  }>;
  recentCompanies: Array<{
    id: string;
    name: string;
    slug: string;
    userCount: number;
    createdAt: string;
  }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

function MetricCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}

function RoleBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'amber' | 'zinc' | 'slate';
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barClass =
    tone === 'amber' ? 'bg-amber-500' : tone === 'zinc' ? 'bg-zinc-500' : 'bg-slate-400';

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-zinc-600">{label}</span>
        <span className="tabular-nums text-zinc-900">
          {count}
          <span className="ml-1 text-xs font-normal text-zinc-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AdminOverview() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityTab, setActivityTab] = useState<'users' | 'companies'>('users');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading control panel...
      </div>
    );
  }

  const { stats, recentUsers, recentCompanies } = data;
  const integrationPct =
    stats.companyCount > 0
      ? Math.round((stats.companiesWithIntegrations / stats.companyCount) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        title="Control panel"
        description="Monitor tenants, user growth, and integration coverage across the platform."
      />

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <MetricCell label="Companies" value={stats.companyCount} />
          <MetricCell label="Users" value={stats.userCount} />
          <MetricCell
            label="Integrations"
            value={`${integrationPct}%`}
            hint={`${stats.companiesWithIntegrations} of ${stats.companyCount} configured`}
          />
          <MetricCell label="Platform admins" value={stats.appAdminCount} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/companies"
          className="group flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50/30"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 group-hover:bg-amber-100 group-hover:text-amber-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-zinc-900">Manage companies</div>
            <div className="text-xs text-zinc-500">
              {stats.companiesWithoutIntegrations} need integration setup
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
        </Link>
        <Link
          href="/admin/users"
          className="group flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50/30"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 group-hover:bg-amber-100 group-hover:text-amber-700">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-zinc-900">Manage users</div>
            <div className="text-xs text-zinc-500">
              {stats.companyAdminCount} company admins · {stats.memberCount} company users
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              {activityTab === 'users' ? (
                <UserPlus className="h-4 w-4 text-zinc-400" />
              ) : (
                <Building2 className="h-4 w-4 text-zinc-400" />
              )}
              <h2 className="text-sm font-semibold text-zinc-900">Recent activity</h2>
            </div>
            <div className="flex rounded-md border border-zinc-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActivityTab('users')}
                className={cn(
                  'rounded px-2.5 py-1 font-medium transition-colors',
                  activityTab === 'users'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-800'
                )}
              >
                Users
              </button>
              <button
                type="button"
                onClick={() => setActivityTab('companies')}
                className={cn(
                  'rounded px-2.5 py-1 font-medium transition-colors',
                  activityTab === 'companies'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-800'
                )}
              >
                Companies
              </button>
            </div>
          </div>

          {activityTab === 'users' ? (
            <div className="divide-y divide-zinc-100">
              {recentUsers.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">No users yet.</p>
              ) : (
                recentUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50/80"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">
                      {(u.name || u.email).charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-zinc-900">{u.name || u.email}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {u.companyName ?? 'No company'} · {u.email}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <RoleBadge role={u.role} />
                      <span className="text-[11px] text-zinc-400">{formatRelative(u.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {recentCompanies.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">No companies yet.</p>
              ) : (
                recentCompanies.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/companies/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-zinc-50/80"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-xs font-bold text-amber-800">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-zinc-900">{c.name}</div>
                      <div className="truncate font-mono text-xs text-zinc-500">{c.slug}</div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-zinc-400">
                      <div>{c.userCount} users</div>
                      <div>{formatRelative(c.createdAt)}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          <div className="border-t border-zinc-100 px-4 py-2.5 text-right">
            <Link
              href={activityTab === 'users' ? '/admin/users' : '/admin/companies'}
              className="text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              View all {activityTab === 'users' ? 'users' : 'companies'} →
            </Link>
          </div>
        </section>

        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">User roles</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Distribution across {stats.userCount} accounts</p>
            <div className="mt-4 space-y-4">
              <RoleBar
                label="Platform admins"
                count={stats.appAdminCount}
                total={stats.userCount}
                tone="amber"
              />
              <RoleBar
                label="Company admins"
                count={stats.companyAdminCount}
                total={stats.userCount}
                tone="zinc"
              />
              <RoleBar
                label="Company Users"
                count={stats.memberCount}
                total={stats.userCount}
                tone="slate"
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Integration health</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3 rounded-md bg-emerald-50/80 px-3 py-2.5">
                <Plug className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-emerald-900">
                    {stats.companiesWithIntegrations} configured
                  </div>
                  <div className="text-xs text-emerald-700/80">API keys and webhooks in place</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-zinc-50 px-3 py-2.5">
                <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-zinc-800">
                    {stats.companiesWithoutIntegrations} pending setup
                  </div>
                  <div className="text-xs text-zinc-500">Onboarding or API configuration incomplete</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
