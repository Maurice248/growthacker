'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Loader2, Search } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminOperationEvent, NormalizedOperationStatus, OperationsSummary } from '@/lib/admin/operations';

type CompanyOption = { id: string; name: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const MODULES = ['Cold Email', 'Social Channels', 'Newsletter', 'Blog', 'Meta Ads'];

export function OperationsPanel() {
  const [events, setEvents] = useState<AdminOperationEvent[]>([]);
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('all');
  const [module, setModule] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<AdminOperationEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (companyId !== 'all') params.set('companyId', companyId);
      if (module !== 'all') params.set('module', module);
      if (status !== 'all') params.set('status', status);

      const [opsRes, companiesRes] = await Promise.all([
        fetch(`/api/admin/operations?${params}`),
        fetch('/api/admin/companies'),
      ]);
      const opsData = await opsRes.json();
      const companiesData = await companiesRes.json();
      if (!opsRes.ok) throw new Error(opsData.error || 'Failed to load operations');
      if (!companiesRes.ok) throw new Error(companiesData.error || 'Failed to load companies');
      setEvents(opsData.events);
      setSummary(opsData.summary);
      setCompanies(companiesData.map((c: CompanyOption) => ({ id: c.id, name: c.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operations');
    } finally {
      setLoading(false);
    }
  }, [companyId, module, status]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.module.toLowerCase().includes(q) ||
        (e.companyName?.toLowerCase().includes(q) ?? false) ||
        (e.error?.toLowerCase().includes(q) ?? false)
    );
  }, [events, query]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading operations...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        title="Operations"
        description="Cross-platform workflow health — recent jobs, failures, and durations."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {summary && (
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
            {[
              { label: 'Last 24h', value: summary.total24h },
              { label: 'Last 7d', value: summary.total7d },
              { label: 'Failed (24h)', value: summary.failed24h },
              { label: 'Failed (7d)', value: summary.failed7d },
              { label: 'Pending now', value: summary.pending },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 py-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search label, company, error..."
            className="pl-9"
          />
        </div>
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {MODULES.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(['success', 'failed', 'pending', 'other'] as NormalizedOperationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                  No operations found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {event.companyId && event.companyName ? (
                      <Link href={`/admin/companies/${event.companyId}`} className="font-medium hover:underline">
                        {event.companyName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.module}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{event.label}</TableCell>
                  <TableCell>
                    <AdminStatusBadge status={event.normalizedStatus} label={event.status} />
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-500">{formatDuration(event.durationMs)}</TableCell>
                  <TableCell className="text-slate-500">{formatDate(event.createdAt)}</TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(event)}>
                      Details
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.label}</DialogTitle>
                <DialogDescription>
                  {selected.module} · {selected.companyName ?? 'No company'} · {formatDate(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <AdminStatusBadge status={selected.normalizedStatus} label={selected.status} />
                  <Badge variant="outline">{selected.sourceType}</Badge>
                </div>
                {selected.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                    <p className="font-medium">Error</p>
                    <p className="mt-1 whitespace-pre-wrap">{selected.error}</p>
                  </div>
                )}
                <div>
                  <p className="mb-2 font-medium text-zinc-900">Detail</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">
                    {JSON.stringify(selected.detail, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
