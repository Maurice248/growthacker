'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { formatRelativeTime } from '@/lib/utils';
import { useAppSection } from '@/lib/app-section';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialPillButton,
  EditorialSectionHeader,
  EditorialStatCell,
} from '@/components/cold-email/outreach-ui';

interface CleanupStatusData {
  lastCleanup: string | null;
  nextScheduled: string | null;
  totalDeleted: number;
  totalRuns: number;
}

export function CleanupStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { section } = useAppSection();
  const isOutreach = section === 'outreach';

  const { data: status, isLoading } = useQuery({
    queryKey: ['cleanup-status'],
    queryFn: async () => {
      const res = await axios.get<CleanupStatusData>('/api/cleanup/status');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const triggerCleanup = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/cleanup/trigger', { force_cleanup: true });
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Cleanup completed!',
        description: `Deleted ${data.result?.results?.deleted_count || 0} contacts from Instantly`,
      });
      queryClient.invalidateQueries({ queryKey: ['cleanup-status'] });
      queryClient.invalidateQueries({ queryKey: ['cleanup-logs'] });
    },
    onError: () => {
      toast({
        title: 'Cleanup failed',
        description: 'Failed to trigger cleanup. Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (isOutreach) {
    return (
      <section>
        <EditorialSectionHeader
          title="Cleanup Status"
          meta="Removes oldest sent leads on schedule"
        />

        <div className="grid grid-cols-2 border-b border-[var(--border)] lg:grid-cols-4">
          <EditorialStatCell
            isFirst
            label="Last cleanup"
            value={
              isLoading
                ? '…'
                : status?.lastCleanup
                  ? formatRelativeTime(status.lastCleanup)
                  : 'Never run'
            }
            className="py-5 text-[22px]"
          />
          <EditorialStatCell
            label="Next scheduled"
            value={
              isLoading
                ? '…'
                : status?.nextScheduled
                  ? formatRelativeTime(status.nextScheduled)
                  : 'Not scheduled'
            }
            className="py-5 text-[22px]"
          />
          <EditorialStatCell
            label="Total deleted"
            value={status?.totalDeleted ?? 0}
            className="py-5 text-[22px]"
          />
          <EditorialStatCell
            isLast
            label="Total runs"
            value={status?.totalRuns ?? 0}
            className="py-5 text-[22px]"
          />
        </div>

        <EditorialDefinitionList>
          <EditorialDefinitionRow label="Manual trigger" isLast>
            <div>
              <p className="m-0 text-sm leading-relaxed text-[#4A5A64]">
                Run cleanup now without waiting for the schedule. This deletes the oldest sent leads from your
                Instantly.ai campaign and resets their status in your lead lists.
              </p>
              <EditorialPillButton
                variant="danger"
                disabled={triggerCleanup.isPending}
                onClick={() => triggerCleanup.mutate()}
                style={{ marginTop: 16 }}
              >
                {triggerCleanup.isPending ? 'Cleaning up…' : 'Run cleanup now'}
              </EditorialPillButton>
            </div>
          </EditorialDefinitionRow>
        </EditorialDefinitionList>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-[#003049]" />
            Cleanup Status
          </CardTitle>
          <CardDescription>
            Removes oldest sent leads from your Instantly.ai campaign on schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Last Cleanup</p>
              <p className="font-medium">
                {status?.lastCleanup ? formatRelativeTime(status.lastCleanup) : 'Never run'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Next Scheduled</p>
              <p className="font-medium">
                {status?.nextScheduled ? formatRelativeTime(status.nextScheduled) : 'Not scheduled'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Total Deleted</p>
              <p className="text-2xl font-bold text-gray-900">{status?.totalDeleted ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Total Runs</p>
              <p className="text-2xl font-bold text-gray-900">{status?.totalRuns ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed border-2 border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">Manual Trigger</CardTitle>
          <CardDescription>Run cleanup now without waiting for schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-800">
              This deletes the oldest sent leads from your Instantly.ai campaign and resets their status in your lead lists.
            </p>
          </div>
          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => triggerCleanup.mutate()}
            disabled={triggerCleanup.isPending}
          >
            {triggerCleanup.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {triggerCleanup.isPending ? 'Cleaning up...' : 'Run Cleanup Now'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
