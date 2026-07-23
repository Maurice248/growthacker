'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialPillButton,
  EditorialStatusPill,
} from '@/app/components';
import {
  EditorialSectionHeader,
  EditorialStatCell,
  EditorialStatRibbon,
  editorialPillButtonClass,
  editorialPillButtonDangerClass,
  editorialTextLinkClass,
} from '@/components/editorial/editorial-layout';
import { cn } from '@/lib/utils';

export {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialPillButton,
  EditorialStatusPill,
  EditorialSectionHeader,
  EditorialStatCell,
  EditorialStatRibbon,
  editorialPillButtonClass,
  editorialPillButtonDangerClass,
  editorialTextLinkClass,
};

const selectClass =
  'w-full max-w-full border-0 border-b border-[var(--border-mid)] bg-transparent py-2 text-sm font-bold text-[var(--primary)] outline-none focus:border-[var(--red)] cursor-pointer';

export function OutreachSelect({
  value,
  onChange,
  placeholder,
  disabled,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(selectClass, className)}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

const METRIC_INPUT_WIDTH = {
  sm: 72,
  md: 96,
} as const;

function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, '');
}

export function OutreachMetricInput({
  value,
  onChange,
  disabled,
  className,
  min,
  max,
  width = 'sm',
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  width?: keyof typeof METRIC_INPUT_WIDTH;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const restoreRef = useRef(value);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft ?? value}
      onChange={(e) => setDraft(sanitizeIntegerInput(e.target.value))}
      disabled={disabled}
      style={{ width: METRIC_INPUT_WIDTH[width] }}
      className={cn('editorial-metric-input', className)}
      onFocus={() => {
        restoreRef.current = value;
        setDraft(value);
      }}
      onBlur={() => {
        const raw = draft ?? '';
        if (raw === '') {
          onChange(restoreRef.current);
        } else {
          let num = Number(raw);
          if (Number.isFinite(num)) {
            if (min !== undefined) num = Math.max(min, num);
            if (max !== undefined) num = Math.min(max, num);
            onChange(String(num));
          } else {
            onChange(restoreRef.current);
          }
        }
        setDraft(null);
      }}
    />
  );
}

export function OutreachActionLink({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'muted';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'border-none bg-transparent p-0 text-[13px] font-bold transition-colors disabled:opacity-50',
        variant === 'primary'
          ? 'border-b border-[var(--border-mid)] text-[var(--primary)] hover:border-[var(--red)] hover:text-[var(--red)]'
          : 'text-[var(--text-muted)] hover:text-[var(--red)]'
      )}
    >
      {children}
    </button>
  );
}

export function OutreachListRow({
  title,
  meta,
  actions,
  status,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-center gap-4 border-b border-[var(--border)] py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]',
        className
      )}
    >
      <div className="min-w-0">
        <div className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--primary)]">
          {title}
        </div>
        {meta && <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">{meta}</div>}
      </div>
      {actions && <div className="flex gap-3.5">{actions}</div>}
      {status && <div className="justify-self-start sm:justify-self-end">{status}</div>}
    </div>
  );
}

export function campaignStatusPill(status: string) {
  const normalized = status.replace(/_/g, ' ');
  if (status === 'PENDING_APPROVAL') {
    return <EditorialStatusPill variant="unapproved">{normalized}</EditorialStatusPill>;
  }
  if (status === 'REJECTED' || status === 'FAILED') {
    return <EditorialStatusPill variant="neutral">{normalized}</EditorialStatusPill>;
  }
  return <EditorialStatusPill variant="approved">{normalized}</EditorialStatusPill>;
}

export function workflowStatusPill(status: string) {
  if (status === 'SUCCESS') {
    return <EditorialStatusPill variant="approved">Success</EditorialStatusPill>;
  }
  if (status === 'FAILED') {
    return <EditorialStatusPill variant="neutral">Failed</EditorialStatusPill>;
  }
  return <EditorialStatusPill variant="unapproved">{status.replace(/_/g, ' ')}</EditorialStatusPill>;
}

export function OutreachBackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[13px] font-bold text-[#4A5A64] hover:text-[var(--primary)]">
      {children}
    </Link>
  );
}

export function OutreachCampaignBarChart({
  data,
}: {
  data: { month: string; count: number; sent: number }[];
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.count, d.sent]));

  return (
    <div>
      <EditorialSectionHeader title="Campaigns per Month" meta="Campaigns · emails sent" />
      <div className="flex h-[180px] items-end gap-6 border-b border-[var(--border)] px-2 pt-6">
        {data.map((item) => {
          const campaignHeight = `${Math.max((item.count / max) * 100, item.count > 0 ? 4 : 0)}%`;
          const sentHeight = `${Math.max((item.sent / max) * 100, item.sent > 0 ? 4 : 0)}%`;
          return (
            <div key={item.month} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-[140px] w-full items-end gap-1">
                <div
                  className="flex-1 bg-[var(--primary)]"
                  style={{ height: campaignHeight }}
                  title={`${item.count} campaigns`}
                />
                <div
                  className="flex-1 bg-[var(--secondary)]"
                  style={{ height: sentHeight }}
                  title={`${item.sent} emails sent`}
                />
              </div>
              <div className="text-[11.5px] text-[var(--text-muted)]">{item.month}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OutreachLeadBarChart({
  data,
  title = 'Leads by Table',
}: {
  data: { sheet: string; count: number }[];
  title?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0) || 1;
  const colors = ['var(--primary)', 'var(--secondary)', '#48cae4', '#7FA6BC'];

  return (
    <div>
      <EditorialSectionHeader title={title} />
      <div className="flex flex-col gap-[18px] pt-6">
        {data.map((item, index) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={item.sheet}>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="truncate font-bold text-[var(--primary)]">{item.sheet}</span>
                <span className="text-[var(--text-muted)]">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border-light)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: colors[index % colors.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OutreachEmptyState({
  message,
  action,
}: {
  message: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border)] py-16 text-center text-[var(--text-muted)]">
      <p className="text-[15px]">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
