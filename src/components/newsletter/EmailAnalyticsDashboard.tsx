'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  CheckCircle,
  XCircle,
  TrendingUp,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
} from 'recharts';

const EVENT_TYPES = [
  { key: 'delivered', label: 'Delivered', color: '#22c55e' },
  { key: 'bounced', label: 'Bounced', color: '#f87171' },
  { key: 'suppressed', label: 'Suppressed', color: '#6b7280' },
  { key: 'opened', label: 'Opened', color: '#3b82f6' },
  { key: 'clicked', label: 'Clicked', color: '#a855f7' },
];

const FILTER_OPTIONS = [
  { key: 'all', label: 'All Events' },
  ...EVENT_TYPES,
];

const PERIOD_OPTIONS = [
  { label: 'Today', days: 1 },
  { label: 'Yesterday', days: 2 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 15 days', days: 15 },
  { label: 'Last 30 days', days: 30 },
];

const DELIVERED_KEYS = new Set(['delivered', 'opened', 'clicked', 'unsubscribed', 'complained']);
const CACHE_KEY = 'resend_full_chart';

interface ChartPoint {
  date: string;
  ts: number;
  delivered?: number;
  bounced?: number;
  suppressed?: number;
  opened?: number;
  clicked?: number;
  [key: string]: string | number | undefined;
}

interface Campaign {
  id: string;
  template_id: string;
  subject_line: string;
  limit_for_daily: number;
  audience_limit: string;
  sent_count: number;
  send_hour: number;
  send_minute: number;
  send_timezone: string;
  name: string;
}

function aggregateStats(chartData: ChartPoint[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);
  const cutoffTs = cutoff.getTime();

  const filtered = chartData.filter((p) => p.ts >= cutoffTs);
  const eventCounts: Record<string, number> = {};

  for (const point of filtered) {
    for (const [key, val] of Object.entries(point)) {
      if (key !== 'date' && key !== 'ts' && typeof val === 'number') {
        eventCounts[key] = (eventCounts[key] || 0) + val;
      }
    }
  }

  const delivered = Object.entries(eventCounts)
    .filter(([k]) => DELIVERED_KEYS.has(k))
    .reduce((sum, [, v]) => sum + v, 0);
  const bounced = eventCounts.bounced || 0;
  const exclude = new Set(['suppressed', 'failed']);
  const total = Object.entries(eventCounts)
    .filter(([k]) => !exclude.has(k))
    .reduce((sum, [, v]) => sum + v, 0);
  const deliverabilityRate = total > 0 ? +((delivered / total) * 100).toFixed(2) : 0;

  return { total, delivered, bounced, deliverabilityRate, eventCounts, chartData: filtered };
}

export default function EmailAnalyticsDashboard() {
  const [chartData, setChartData] = useState<ChartPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodDays, setPeriodDays] = useState(30);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);

  useEffect(() => {
    fetch('/api/newsletter/campaigns')
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) {
          setCampaigns(json.campaigns || []);
          setSubscriberCount(json.subscriberCount ?? json.leadCounts?.subscribers ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback((force = false) => {
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < 300_000) {
            setChartData(data);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    setChartData(null);
    setLoading(true);
    setError('');
    fetch('/api/resend/stats')
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setChartData(json.chartData);
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.chartData, ts: Date.now() }));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => (chartData ? aggregateStats(chartData, periodDays) : null),
    [chartData, periodDays]
  );

  const visibleLines =
    eventFilter === 'all'
      ? EVENT_TYPES.filter((e) => stats?.eventCounts?.[e.key])
      : EVENT_TYPES.filter((e) => e.key === eventFilter);

  const filterLabel = FILTER_OPTIONS.find((o) => o.key === eventFilter)?.label || 'All Events';
  const periodLabel = PERIOD_OPTIONS.find((o) => o.days === periodDays)?.label || 'Last 30 days';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        <svg className="mr-3 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => load(true)}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pieData = EVENT_TYPES.filter((e) => stats?.eventCounts?.[e.key]).map((e) => ({
    name: e.label,
    value: stats!.eventCounts[e.key],
    fill: e.color,
  }));

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-4" style={{ marginTop: 25 }}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Analytics</h1>
          <p className="mt-1 text-gray-500">
            Resend delivery stats for{' '}
            <span className="font-medium text-gray-700">tenantreport.ai</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              {periodLabel}
            </button>
            {periodOpen && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => {
                      setPeriodDays(opt.days);
                      setPeriodOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                      periodDays === opt.days ? 'font-medium text-indigo-600' : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-2 items-stretch gap-3 md:gap-4 lg:grid-cols-4"
        style={{ marginTop: 40, marginBottom: 40 }}
      >
        <StatCard
          label="Total Emails"
          value={stats?.total ?? 0}
          theme="indigo"
          icon={Mail}
        />
        <StatCard
          label="Delivered"
          value={stats?.delivered ?? 0}
          theme="emerald"
          icon={CheckCircle}
        />
        <StatCard
          label="Bounced"
          value={stats?.bounced ?? 0}
          sub={
            (stats?.total ?? 0) > 0
              ? `${(((stats?.bounced ?? 0) / (stats?.total ?? 1)) * 100).toFixed(1)}% bounce rate`
              : undefined
          }
          theme="red"
          icon={XCircle}
        />
        <StatCard
          label="Deliverability"
          value={`${stats?.deliverabilityRate ?? 0}%`}
          theme="violet"
          icon={TrendingUp}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Events Over Time</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                {filterLabel}
              </button>
              {filterOpen && (
                <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setEventFilter(opt.key);
                        setFilterOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                        eventFilter === opt.key ? 'font-medium text-indigo-600' : 'text-gray-700'
                      }`}
                    >
                      {'color' in opt && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: opt.color }} />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats?.chartData || []} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f9fafb',
                  fontSize: '12px',
                }}
              />
              {visibleLines.map((e) => (
                <Line
                  key={e.key}
                  type="linear"
                  dataKey={e.key}
                  stroke={e.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-gray-700">Event Distribution</p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" />
                  <Tooltip
                    contentStyle={{
                      background: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f9fafb',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {pieData.map((item) => {
                  const pct = (stats?.total ?? 0) > 0 ? Math.round((item.value / (stats?.total ?? 1)) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.fill }} />
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{item.value}</span>
                        <span className="w-8 text-right text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">No data</div>
          )}
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
            <p className="text-sm font-semibold text-gray-700">Currently Running Newsletters</p>
            <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              {campaigns.length} active
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const leads = subscriberCount;
              const daily = Number(c.limit_for_daily || 0);
              const daysLeft = daily > 0 ? Math.ceil(leads / daily) : 0;
              const tid = String(c.template_id || '');
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">{c.name}</p>
                  <p className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-gray-800">
                    {c.subject_line || '—'}
                  </p>
                  <p className="mb-3 truncate font-mono text-xs text-gray-500" title={tid}>
                    #{tid.slice(0, 8)}…{tid.slice(-4)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-lg bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                      {leads.toLocaleString()} subscribers · {c.audience_limit}
                    </span>
                    <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      {daily}/day · {c.send_hour}:{String(c.send_minute).padStart(2, '0')} {c.send_timezone || 'UTC'} · ~{daysLeft}d left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  theme,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  theme: 'indigo' | 'emerald' | 'red' | 'violet';
  icon: LucideIcon;
}) {
  const themes = {
    indigo: {
      card: 'bg-indigo-50 border-indigo-100',
      value: 'text-indigo-700',
      iconWrap: 'bg-indigo-100',
      icon: 'text-indigo-600',
      sub: 'text-indigo-400',
    },
    emerald: {
      card: 'bg-emerald-50 border-emerald-100',
      value: 'text-emerald-700',
      iconWrap: 'bg-emerald-100',
      icon: 'text-emerald-600',
      sub: 'text-emerald-400',
    },
    red: {
      card: 'bg-red-50 border-red-100',
      value: 'text-red-600',
      iconWrap: 'bg-red-100',
      icon: 'text-red-500',
      sub: 'text-red-400',
    },
    violet: {
      card: 'bg-violet-50 border-violet-100',
      value: 'text-violet-700',
      iconWrap: 'bg-violet-100',
      icon: 'text-violet-600',
      sub: 'text-violet-400',
    },
  };
  const t = themes[theme];

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border ${t.card}`}
      style={{
        padding: '20px 24px',
        minHeight: 112,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="min-w-0 flex-1 text-[11px] font-bold uppercase leading-snug text-gray-500 opacity-75"
          style={{ letterSpacing: '0.05em' }}
        >
          {label}
        </p>
        <span className={`shrink-0 rounded-lg p-1.5 ${t.iconWrap}`}>
          <Icon className={`h-4 w-4 ${t.icon}`} strokeWidth={2} />
        </span>
      </div>
      <div style={{ paddingTop: 8 }}>
        <p className={`text-[26px] font-extrabold leading-tight tracking-tight ${t.value}`}>{value}</p>
        <p className={`mt-1 min-h-[16px] text-xs ${sub ? t.sub : 'text-transparent select-none'}`}>
          {sub || '\u00A0'}
        </p>
      </div>
    </div>
  );
}
