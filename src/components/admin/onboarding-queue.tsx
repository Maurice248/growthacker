'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type OnboardingBlocker =
  | 'onboarding_incomplete'
  | 'no_integrations'
  | 'no_brand_config'
  | 'no_users'
  | 'no_successful_workflow';

type OnboardingRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  blockers: OnboardingBlocker[];
  userCount: number;
  integrationsConfigured: boolean;
};

const BLOCKER_META: Record<
  OnboardingBlocker,
  { label: string; hint: string; tone: 'amber' | 'red' | 'zinc' }
> = {
  onboarding_incomplete: {
    label: 'Onboarding incomplete',
    hint: 'Company has not finished the onboarding wizard',
    tone: 'amber',
  },
  no_integrations: {
    label: 'No integrations',
    hint: 'Check Diagnostics for missing API keys',
    tone: 'amber',
  },
  no_brand_config: {
    label: 'Missing brand config',
    hint: 'Brand profile not saved yet',
    tone: 'amber',
  },
  no_users: {
    label: 'No team members',
    hint: 'Invite at least one user to the company',
    tone: 'red',
  },
  no_successful_workflow: {
    label: 'No successful run',
    hint: 'No workflow has completed successfully yet',
    tone: 'zinc',
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function BlockerChip({ blocker }: { blocker: OnboardingBlocker }) {
  const meta = BLOCKER_META[blocker];
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        meta.tone === 'red' && 'border-red-200 bg-red-50/60',
        meta.tone === 'amber' && 'border-amber-200 bg-amber-50/60',
        meta.tone === 'zinc' && 'border-zinc-200 bg-zinc-50'
      )}
    >
      <p className="text-sm font-medium text-zinc-900">{meta.label}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{meta.hint}</p>
    </div>
  );
}

export function OnboardingQueue() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/onboarding');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load onboarding queue');
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.blockers.some((b) => BLOCKER_META[b].label.toLowerCase().includes(q))
    );
  }, [rows, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading onboarding queue...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        title="Onboarding queue"
        description="Companies that still need setup before they can operate — onboarding, team, brand, or first successful run."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <section className="rounded-lg border border-amber-200/80 bg-amber-50/40 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">{rows.length}</span> compan{rows.length === 1 ? 'y' : 'ies'}{' '}
          need attention before go-live.
        </section>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies or blockers..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-16 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-zinc-700">
            {rows.length === 0
              ? 'All companies have completed onboarding.'
              : 'No companies match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((row) => (
            <article
              key={row.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/companies/${row.id}`}
                      className="text-base font-semibold text-zinc-900 hover:text-amber-800 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <Badge variant="outline" className="text-amber-800">
                      {row.blockers.length} blocker{row.blockers.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-zinc-500">{row.slug}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {row.userCount} user{row.userCount === 1 ? '' : 's'}
                    </span>
                    <span>Created {formatDate(row.createdAt)}</span>
                    <Badge variant={row.integrationsConfigured ? 'secondary' : 'outline'}>
                      {row.integrationsConfigured ? 'Integrations OK' : 'Integrations pending'}
                    </Badge>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild className="gap-1.5">
                    <Link href={`/admin/companies/${row.id}`}>
                      Details
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  {row.blockers.includes('no_integrations') && (
                    <Button type="button" variant="ghost" size="sm" asChild>
                      <Link href="/admin/diagnostics">Diagnostics →</Link>
                    </Button>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50/40 p-4 sm:p-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  What&apos;s blocking go-live
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {row.blockers.map((b) => (
                    <BlockerChip key={b} blocker={b} />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
