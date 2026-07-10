'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type UsageWindow = '7d' | '30d';

type UsageData = {
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

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value.toLocaleString()}</div>
    </div>
  );
}

export function UsageDashboard() {
  const [window, setWindow] = useState<UsageWindow>('7d');
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usage?window=${window}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load usage');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading usage...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        title="Usage"
        description="Platform-wide automation volume by company and time window."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {(['7d', '30d'] as UsageWindow[]).map((w) => (
          <Button
            key={w}
            type="button"
            size="sm"
            variant={window === w ? 'default' : 'outline'}
            onClick={() => setWindow(w)}
          >
            Last {w === '7d' ? '7 days' : '30 days'}
          </Button>
        ))}
      </div>

      {data && (
        <>
          <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 xl:grid-cols-7">
              <MetricCell label="Newsletters sent" value={data.platform.newslettersSent} />
              <MetricCell label="Leads scraped" value={data.platform.leadsScraped} />
              <MetricCell label="Outreach leads" value={data.platform.outreachLeads} />
              <MetricCell label="Emails pushed" value={data.platform.emailsPushed} />
              <MetricCell label="Social jobs" value={data.platform.socialJobs} />
              <MetricCell label="Blog posts" value={data.platform.blogJobsCompleted} />
              <MetricCell label="Workflow failures" value={data.platform.workflowFailures} />
            </div>
          </section>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Newsletters</TableHead>
                  <TableHead className="text-right">Scraped</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Emails</TableHead>
                  <TableHead className="text-right">Social</TableHead>
                  <TableHead className="text-right">Blog</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byCompany.filter((c) => c.totalActivity > 0).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                      No activity in this window.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.byCompany
                    .filter((c) => c.totalActivity > 0)
                    .map((row, i) => (
                      <TableRow key={row.companyId}>
                        <TableCell>
                          <Link href={`/admin/companies/${row.companyId}`} className="font-medium hover:underline">
                            {row.companyName}
                          </Link>
                          {i < 3 && (
                            <span className={cn('ml-2 text-[10px] font-semibold uppercase text-amber-700')}>
                              Top
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.newslettersSent}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.leadsScraped}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.outreachLeads}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.emailsPushed}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.socialJobs}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.blogJobsCompleted}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{row.totalActivity}</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
