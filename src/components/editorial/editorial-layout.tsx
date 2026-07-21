import { cn } from '@/lib/utils';

export function EditorialShellMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        'editorial-shell-main flex-1 overflow-y-auto bg-[var(--background)]',
        className
      )}
    >
      {children}
    </main>
  );
}

export function EditorialPage({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'editorial-page mx-auto w-full max-w-[980px] px-5 pb-16 pt-14 md:px-[72px] md:pb-24 md:pt-14',
        wide && 'max-w-[1080px]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function EditorialPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-10 flex flex-wrap items-end justify-between gap-5', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {eyebrow}
          </div>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-[34px] font-bold leading-[1.1] tracking-[-0.8px] text-[var(--text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-[15px] leading-relaxed text-[#4A5A64]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-baseline gap-6">{actions}</div>}
    </header>
  );
}

export function EditorialSectionHeader({
  title,
  meta,
  className,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between border-b border-[var(--primary)] pb-3.5',
        className
      )}
    >
      <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--red)] font-[family-name:var(--font-display)]">
        {title}
      </div>
      {meta && <div className="text-[13px] text-[var(--text-muted)]">{meta}</div>}
    </div>
  );
}

export function EditorialTabBar({
  tabs,
  activeId,
  onChange,
  className,
}: {
  tabs: { id: string; label: React.ReactNode; count?: number }[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-7 border-b border-[var(--primary)]', className)}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm transition-colors',
              active
                ? 'border-[var(--red)] font-bold text-[var(--red)]'
                : 'border-transparent font-normal text-[#4A5A64] hover:border-[#C2B79A] hover:text-[var(--primary)]'
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="text-[#8C8474]"> · {tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EditorialStatRibbon({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'editorial-stat-ribbon grid border-t border-[var(--primary)]',
        columns === 3 && 'grid-cols-1 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {children}
    </section>
  );
}

export function EditorialStatCell({
  label,
  value,
  sub,
  accent = 'default',
  isFirst,
  isLast,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: 'default' | 'danger' | 'muted';
  isFirst?: boolean;
  isLast?: boolean;
  className?: string;
}) {
  const valueColor =
    accent === 'danger'
      ? 'text-[var(--red)]'
      : accent === 'muted'
        ? 'text-[var(--text-muted)]'
        : 'text-[var(--primary)]';
  const labelColor = accent === 'danger' ? 'text-[var(--red)]' : 'text-[var(--text-muted)]';

  return (
    <div
      className={cn(
        'border-[var(--border)] py-6',
        !isLast && 'border-r',
        isFirst ? 'pr-6 pl-0' : isLast ? 'pl-6 pr-0' : 'px-6',
        className
      )}
    >
      <div
        className={cn(
          'font-[family-name:var(--font-display)] text-[40px] font-bold leading-none',
          valueColor
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'mt-2.5 text-xs uppercase tracking-[0.08em]',
          labelColor
        )}
      >
        {label}
      </div>
      {sub && <div className="mt-0.5 text-[13px] text-[#4A5A64]">{sub}</div>}
    </div>
  );
}

export const editorialFlatPanelClass =
  'border-t border-[var(--border)] bg-transparent shadow-none';

export const editorialPillButtonClass =
  'inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-[#FDF0D5] transition-colors hover:bg-[var(--red)] disabled:cursor-not-allowed disabled:opacity-60';

export const editorialTextLinkClass =
  'inline-flex border-none bg-transparent p-0 text-sm font-bold text-[#4A5A64] hover:text-[var(--primary)] disabled:opacity-50';
