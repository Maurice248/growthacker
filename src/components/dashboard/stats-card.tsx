import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  className?: string;
  iconClassName?: string;
  variant?: 'dashboard' | 'outreach';
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  iconClassName,
}: StatsCardProps) {
  void Icon;
  void iconClassName;

  return (
    <div
      className={cn(
        'border-r border-[var(--border)] py-6 pr-6 last:border-r-0',
        className
      )}
    >
      <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-[34px] font-bold leading-none text-[var(--primary)]">
        {value}
      </div>
      {subtitle && <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">{subtitle}</p>}
      {trend && (
        <p
          className={cn(
            'mt-1 text-xs font-medium',
            trend.positive ? 'text-green-700' : 'text-[var(--red)]'
          )}
        >
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
        </p>
      )}
    </div>
  );
}
