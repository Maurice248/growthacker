'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Search,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type DiagnosticsRow = {
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

const MODULE_SHORT: Record<string, string> = {
  meta: 'Meta',
  social: 'Social',
  newsletter: 'Newsletter',
  outreach: 'Outreach',
  blog: 'Blog',
};

function ModuleTile({
  module,
}: {
  module: DiagnosticsRow['modules'][number];
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        module.configured
          ? 'border-emerald-200/80 bg-emerald-50/40'
          : 'border-amber-200/80 bg-amber-50/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">{module.label}</p>
          <p className="text-[11px] text-zinc-500">
            {module.configured ? 'Ready' : `${module.missingKeys.length} item(s) needed`}
          </p>
        </div>
        {module.configured ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        )}
      </div>

      {!module.configured && module.missingKeys.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {module.missingKeys.map((key) => (
            <li
              key={key}
              className="flex items-start gap-1.5 rounded-md bg-white/80 px-2 py-1.5 text-[11px] leading-snug text-zinc-600 ring-1 ring-inset ring-zinc-200/80"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              {key}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompanyDiagnosticsCard({
  row,
  defaultExpanded,
}: {
  row: DiagnosticsRow;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const configuredCount = row.modules.filter((m) => m.configured).length;
  const total = row.modules.length;
  const pct = total > 0 ? Math.round((configuredCount / total) * 100) : 0;

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/companies/${row.companyId}`}
              className="text-base font-semibold text-zinc-900 hover:text-amber-800 hover:underline"
            >
              {row.companyName}
            </Link>
            <Badge
              variant={row.integrationsConfigured ? 'default' : 'outline'}
              className={cn(row.integrationsConfigured && 'bg-emerald-600 hover:bg-emerald-600')}
            >
              {row.integrationsConfigured ? 'All set' : 'Incomplete'}
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{row.slug}</p>

          <div className="mt-3 max-w-xs">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-zinc-600">
                {configuredCount}/{total} modules ready
              </span>
              <span className="tabular-nums text-zinc-400">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pct === 100 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/admin/companies/${row.companyId}`}>
              Details
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="gap-1 text-zinc-600"
          >
            {expanded ? 'Hide modules' : 'Show modules'}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            />
          </Button>
        </div>
      </div>

      <div className="border-t border-zinc-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {row.modules.map((m) => (
            <span
              key={m.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                m.configured
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              )}
              title={m.configured ? 'Configured' : m.missingKeys.join(', ')}
            >
              {m.configured ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              {MODULE_SHORT[m.id] ?? m.label}
            </span>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {row.modules.map((m) => (
              <ModuleTile key={m.id} module={m} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function DiagnosticsTable() {
  const [rows, setRows] = useState<DiagnosticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingOnly, setMissingOnly] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/diagnostics?missingOnly=${missingOnly}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load diagnostics');
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  }, [missingOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.companyName.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.modules.some((m) => m.label.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const summary = useMemo(() => {
    const companiesNeedingSetup = filtered.length;
    const missingModules = filtered.reduce((sum, r) => sum + r.missingCount, 0);
    const fullyConfigured = filtered.filter((r) => r.integrationsConfigured).length;
    return { companiesNeedingSetup, missingModules, fullyConfigured };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading diagnostics...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        title="Integration diagnostics"
        description="See which modules are ready and exactly what credentials each company still needs."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!missingOnly && filtered.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Companies shown', value: summary.companiesNeedingSetup },
            { label: 'Fully configured', value: summary.fullyConfigured },
            { label: 'Modules missing setup', value: summary.missingModules },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</div>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies or modules..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={missingOnly ? 'default' : 'outline'}
            onClick={() => setMissingOnly(true)}
          >
            Needs setup
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!missingOnly ? 'default' : 'outline'}
            onClick={() => setMissingOnly(false)}
          >
            All companies
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-zinc-700">
            {missingOnly ? 'All companies are fully configured.' : 'No companies match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((row, index) => (
            <CompanyDiagnosticsCard
              key={row.companyId}
              row={row}
              defaultExpanded={index === 0 || row.missingCount >= 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
