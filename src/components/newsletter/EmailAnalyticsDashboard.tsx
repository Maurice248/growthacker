'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  EditorialPageHeader,
  EditorialSectionHeader,
  EditorialStatCell,
  EditorialStatRibbon,
  editorialTextLinkClass,
} from '@/components/editorial/editorial-layout';
import { cn } from '@/lib/utils';
import './newsletter.css';

const EVENT_TYPES = [
  { key: 'delivered', label: 'Delivered', color: '#38678A' },
  { key: 'bounced', label: 'Bounced', color: '#C1121F' },
  { key: 'suppressed', label: 'Suppressed', color: '#8C8474' },
  { key: 'opened', label: 'Opened', color: '#669BBC' },
  { key: 'clicked', label: 'Clicked', color: '#003049' },
];

const FILTER_OPTIONS = [{ key: 'all', label: 'All events' }, ...EVENT_TYPES];

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
  const deliverabilityRate = total > 0 ? +((delivered / total) * 100).toFixed(0) : 0;

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

  const filterLabel = FILTER_OPTIONS.find((o) => o.key === eventFilter)?.label || 'All events';
  const periodLabel = PERIOD_OPTIONS.find((o) => o.days === periodDays)?.label || 'Last 30 days';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[#8C8474]">
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="border-t border-[#E8DCC2] py-8 text-center">
          <p className="font-medium text-[#C1121F]">{error}</p>
          <button type="button" onClick={() => load(true)} className={cn(editorialTextLinkClass, 'mt-3')}>
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

  const hasChartData = (stats?.chartData?.length ?? 0) > 0;

  return (
    <div className="nl-root w-full">
      <EditorialPageHeader
        eyebrow="Newsletter"
        title="Email Analytics"
        subtitle="Resend delivery stats for tenantreport.ai."
        actions={
          <>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className={editorialTextLinkClass}
            >
              Refresh
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPeriodOpen((o) => !o)}
                className="rounded-full border border-[#C2B79A] px-3.5 py-1.5 text-[13px] text-[#8C8474]"
              >
                {periodLabel}
              </button>
              {periodOpen && (
                <div className="absolute right-0 z-10 mt-1 w-44 border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => {
                        setPeriodDays(opt.days);
                        setPeriodOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-[rgba(0,48,73,0.04)]',
                        periodDays === opt.days ? 'font-bold text-[var(--red)]' : 'text-[#4A5A64]'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />

      <EditorialStatRibbon className="mb-12">
        <EditorialStatCell label="Total emails" value={stats?.total ?? 0} isFirst />
        <EditorialStatCell
          label="Delivered"
          value={stats?.delivered ?? 0}
          className="[&>div:first-child]:text-[#38678A]"
        />
        <EditorialStatCell label="Bounced" value={stats?.bounced ?? 0} accent="danger" />
        <EditorialStatCell
          label="Deliverability"
          value={`${stats?.deliverabilityRate ?? 0}%`}
          accent="muted"
          isLast
        />
      </EditorialStatRibbon>

      <section className="grid grid-cols-1 gap-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="nl-chart-panel">
          <EditorialSectionHeader title="Events Over Time" meta={filterLabel} />
          <div className="relative mt-4">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats?.chartData || []} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DCC2" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8C8474' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8C8474' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#003049',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#FAEDCD',
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
            ) : (
              <div className="nl-chart-empty">
                No events yet — send your first newsletter
              </div>
            )}
            {hasChartData && (
              <div className="absolute right-0 top-0">
                <button
                  type="button"
                  onClick={() => setFilterOpen((o) => !o)}
                  className="text-[13px] text-[#8C8474] hover:text-[var(--primary)]"
                >
                  {filterLabel} ▾
                </button>
                {filterOpen && (
                  <div className="absolute right-0 z-10 mt-1 w-44 border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg">
                    {FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setEventFilter(opt.key);
                          setFilterOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[rgba(0,48,73,0.04)]',
                          eventFilter === opt.key ? 'font-bold text-[var(--red)]' : 'text-[#4A5A64]'
                        )}
                      >
                        {'color' in opt && (
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: opt.color }} />
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="nl-chart-panel">
          <EditorialSectionHeader title="Event Distribution" />
          <div className="mt-4">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#003049',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#FAEDCD',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2 border-b border-[#E8DCC2] pb-4">
                  {pieData.map((item) => {
                    const pct =
                      (stats?.total ?? 0) > 0
                        ? Math.round((item.value / (stats?.total ?? 1)) * 100)
                        : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.fill }} />
                          <span className="text-[#4A5A64]">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--primary)]">{item.value}</span>
                          <span className="w-8 text-right text-[#8C8474]">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="nl-chart-empty">No data</div>
            )}
          </div>
        </div>
      </section>

      {campaigns.length > 0 && (
        <section className="mt-12">
          <EditorialSectionHeader title="Running Campaigns" meta={`${campaigns.length} active`} />
          <div className="mt-4 divide-y divide-[#E8DCC2]">
            {campaigns.map((c) => {
              const leads = subscriberCount;
              const daily = Number(c.limit_for_daily || 0);
              const daysLeft = daily > 0 ? Math.ceil(leads / daily) : 0;
              const tid = String(c.template_id || '');
              return (
                <div key={c.id} className="py-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#8C8474]">{c.name}</p>
                  <p className="mt-1 text-[15px] font-bold text-[var(--primary)]">
                    {c.subject_line || '—'}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-[#8C8474]" title={tid}>
                    #{tid.slice(0, 8)}…{tid.slice(-4)}
                  </p>
                  <p className="mt-2 text-[13px] text-[#4A5A64]">
                    {leads.toLocaleString()} subscribers · {c.audience_limit} · {daily}/day ·{' '}
                    {c.send_hour}:{String(c.send_minute).padStart(2, '0')} {c.send_timezone || 'UTC'} · ~{daysLeft}d
                    left
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-14 text-xs text-[#B0A88F]">version 0.3</div>
    </div>
  );
}
