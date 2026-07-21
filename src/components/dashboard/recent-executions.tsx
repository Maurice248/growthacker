'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Search, Trash2, Copy, CheckCircle, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useAppSection } from '@/lib/app-section';
import { outreachCardClass } from '@/components/outreach/page-body';
import {
  EditorialSectionHeader,
  OutreachActionLink,
  OutreachListRow,
  workflowStatusPill,
} from '@/components/cold-email/outreach-ui';

export interface ExecutionItem {
  id: string;
  workflowType: string;
  workflowName: string | null;
  status: string;
  createdAt: Date;
  campaignId: string | null;
}

const statusColors: Record<string, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  SUCCESS: 'success',
  FAILED: 'destructive',
  RUNNING: 'secondary',
  PENDING: 'warning',
  CANCELLED: 'secondary',
};

function ExecutionIcon({ type }: { type: string }) {
  if (type === 'CAMPAIGN') return <Mail className="h-4 w-4 text-[#003049]" />;
  if (type === 'SCRAPER') return <Search className="h-4 w-4 text-[#003049]" />;
  return <Trash2 className="h-4 w-4 text-[#003049]" />;
}

export function RecentExecutions({ initialExecutions }: { initialExecutions: ExecutionItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { section, basePath } = useAppSection();
  const isOutreach = section === 'outreach';
  const [executions, setExecutions] = useState<ExecutionItem[]>(initialExecutions);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reusingId, setReusingId] = useState<string | null>(null);

  async function handleDelete(exec: ExecutionItem) {
    const name = exec.workflowName || 'this campaign';
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    setDeletingId(exec.id);
    try {
      const url = exec.campaignId
        ? `/api/campaigns/${exec.campaignId}`
        : `/api/executions/${exec.id}`;

      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      setExecutions((prev) => prev.filter((e) => e.id !== exec.id));
      toast({ title: 'Deleted', description: `"${name}" has been removed.` });
    } catch {
      toast({ title: 'Error', description: 'Could not delete. Try again.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReuse(exec: ExecutionItem) {
    if (!exec.campaignId) return;
    setReusingId(exec.id);
    try {
      const res = await fetch(`/api/campaigns/${exec.campaignId}`);
      const json = await res.json();
      if (!res.ok) throw new Error('Failed to load campaign');
      sessionStorage.setItem('reuse_campaign', JSON.stringify(json.originalInput));
      router.push(`${basePath}/campaigns/new`);
    } catch {
      toast({ title: 'Error', description: 'Could not load campaign data.', variant: 'destructive' });
      setReusingId(null);
    }
  }

  const renderRow = (exec: ExecutionItem) => {
    const isCampaignExec = exec.workflowType === 'CAMPAIGN';
    const canReuse = isCampaignExec && !!exec.campaignId;
    const isDeleting = deletingId === exec.id;
    const isReusing = reusingId === exec.id;

    return (
      <div
        key={exec.id}
        className={cn(
          'flex items-center justify-between gap-3 transition-colors',
          isOutreach
            ? cn(outreachCardClass, 'px-4 py-3.5 hover:shadow-md')
            : 'rounded-lg border-b border-gray-100 bg-transparent px-4 py-3 hover:bg-gray-50/50'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#003049]/10">
            <ExecutionIcon type={exec.workflowType} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {exec.workflowName || exec.workflowType}
            </p>
            <p className="text-xs text-gray-500">{formatRelativeTime(exec.createdAt)}</p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Badge variant={statusColors[exec.status] ?? 'secondary'}>{exec.status}</Badge>

          {canReuse && (
            <Button
              size="sm"
              variant="outline"
              disabled={isReusing}
              onClick={() => handleReuse(exec)}
              className="h-8 gap-1 border-[#003049]/30 px-2.5 text-xs text-[#003049] hover:bg-[#003049]/5"
              title="Reuse this campaign"
            >
              <Copy className="h-3 w-3" />
              Reuse
            </Button>
          )}

          {isCampaignExec && (
            <Button
              size="sm"
              variant="outline"
              disabled={isDeleting}
              onClick={() => handleDelete(exec)}
              className="h-8 gap-1 border-red-200 px-2.5 text-xs text-red-500 hover:bg-red-50"
              title="Delete this campaign"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (isOutreach) {
    const renderOutreachRow = (exec: ExecutionItem) => {
      const isCampaignExec = exec.workflowType === 'CAMPAIGN';
      const canReuse = isCampaignExec && !!exec.campaignId;

      return (
        <OutreachListRow
          key={exec.id}
          title={exec.workflowName || exec.workflowType}
          meta={formatRelativeTime(exec.createdAt)}
          actions={
            <>
              {canReuse && (
                <OutreachActionLink
                  disabled={reusingId === exec.id}
                  onClick={() => handleReuse(exec)}
                >
                  Reuse
                </OutreachActionLink>
              )}
              {isCampaignExec && (
                <OutreachActionLink
                  variant="muted"
                  disabled={deletingId === exec.id}
                  onClick={() => handleDelete(exec)}
                >
                  Delete
                </OutreachActionLink>
              )}
            </>
          }
          status={workflowStatusPill(exec.status)}
        />
      );
    };

    return (
      <section>
        <EditorialSectionHeader title="Recent Workflow Executions" meta="Last 11 days" />

        {executions.length === 0 ? (
          <div className="border-t border-[var(--border)] py-12 text-center text-[var(--text-muted)]">
            <CheckCircle className="mx-auto mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">No workflows run yet. Start by creating a campaign!</p>
          </div>
        ) : (
          <div>{executions.map(renderOutreachRow)}</div>
        )}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-[#003049]" />
          Recent Workflow Executions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <CheckCircle className="mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">No workflows run yet. Start by creating a campaign!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">{executions.map(renderRow)}</div>
        )}
      </CardContent>
    </Card>
  );
}
