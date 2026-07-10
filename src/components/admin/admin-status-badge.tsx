'use client';

import { Badge } from '@/components/ui/badge';
import type { NormalizedOperationStatus } from '@/lib/admin/operations';
import { cn } from '@/lib/utils';

export function AdminStatusBadge({
  status,
  label,
}: {
  status: NormalizedOperationStatus | string;
  label?: string;
}) {
  const normalized =
    status === 'success' || status === 'failed' || status === 'pending' || status === 'other'
      ? status
      : 'other';

  const variant =
    normalized === 'success'
      ? 'default'
      : normalized === 'failed'
        ? 'destructive'
        : normalized === 'pending'
          ? 'secondary'
          : 'outline';

  return (
    <Badge variant={variant} className={cn(normalized === 'success' && 'bg-emerald-600 hover:bg-emerald-600')}>
      {label ?? normalized}
    </Badge>
  );
}

export function HealthScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80 ? 'bg-emerald-100 text-emerald-800 ring-emerald-200' :
    score >= 50 ? 'bg-amber-100 text-amber-800 ring-amber-200' :
    'bg-red-100 text-red-800 ring-red-200';

  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset', tone)}>
      {score}/100
    </span>
  );
}
