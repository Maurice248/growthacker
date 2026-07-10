'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string | null; email: string };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAction(action: string) {
  return action.replace(/\./g, ' · ').replace(/_/g, ' ');
}

export function AuditLogTable() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/audit');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load audit log');
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading activity log...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        title="Activity log"
        description="Admin actions across users, companies, and impersonation sessions."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                  No admin activity recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-slate-500">{formatDate(row.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.actor.name ?? row.actor.email.split('@')[0]}</div>
                    <div className="text-xs text-slate-500">{row.actor.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{formatAction(row.action)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{row.targetType}</div>
                    <div className="font-mono text-xs text-slate-500">{row.targetId.slice(0, 12)}…</div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-slate-600">
                    {Object.keys(row.metadata).length > 0
                      ? JSON.stringify(row.metadata)
                      : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
