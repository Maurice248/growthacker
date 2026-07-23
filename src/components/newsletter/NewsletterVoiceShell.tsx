'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Mail, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorialShellGutter } from '@/components/editorial/editorial-shell-gutter';
import { notifyParentEmbedNavigate } from '@/lib/client-dashboard-nav';
import { NewsletterProviders } from '@/components/newsletter/Providers';
import { HideNextDevIndicator } from '@/components/HideNextDevIndicator';

const NAV = [
  {
    label: 'Newsletter',
    icon: Mail,
    children: [
      { label: 'Overview', href: '/newsletter/dashboard' },
      { label: 'Settings', href: '/newsletter/overview' },
      { label: 'Generate Newsletter', href: '/newsletter/generate' },
      { label: 'Create Campaign', href: '/newsletter/campaign' },
      { label: 'Subscribers', href: '/newsletter/subscribers' },
      { label: 'History', href: '/newsletter/history' },
      { label: 'Manage Services', href: '/newsletter/services' },
    ],
  },
];

function NavLink({
  href,
  label,
  active,
  indent,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  indent?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'block border-l-2 text-[15px] transition-colors',
        indent ? 'py-1.5 pl-8 pr-4 text-[13.5px]' : 'px-4 py-2',
        active
          ? 'border-[var(--sidebar-active-border)] bg-[rgba(250,237,205,0.12)] font-bold text-[var(--sidebar-text)]'
          : 'border-transparent font-normal text-[#9FBBD0] hover:border-[#7FA6BC] hover:text-[var(--sidebar-text)]'
      )}
    >
      {label}
    </Link>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const embed = searchParams.get('embed') === '1';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Newsletter: true });

  useEffect(() => {
    if (!embed) return;
    const handler = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href^="/newsletter"]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || href.includes('embed=1')) return;
      event.preventDefault();
      const url = new URL(href, window.location.origin);
      notifyParentEmbedNavigate(url.pathname);
      url.searchParams.set('embed', '1');
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [embed]);

  const sidebar = (
    <aside
      className={cn(
        'flex shrink-0 flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] transition-all duration-300',
        collapsed ? 'w-14' : 'w-56',
        embed ? 'hidden' : 'hidden lg:flex min-h-screen'
      )}
    >
      <div className={cn('border-b border-[var(--sidebar-border)]', collapsed ? 'px-2 py-8' : 'px-7 py-8')}>
        {!collapsed ? (
          <>
            <div className="font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight">Tenant Report</div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#7FA6BC]">Growth Studio</div>
          </>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-[#1A4A66] text-sm font-bold">T</div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((group) => {
          const isOpen = openGroups[group.label] ?? true;
          const groupActive = group.children.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
          );
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !isOpen }))}
                className={cn(
                  'flex w-full items-center border-l-2 border-transparent text-left text-[15px] transition-colors',
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-4 py-2',
                  groupActive
                    ? 'border-[var(--sidebar-active-border)] bg-[rgba(250,237,205,0.12)] font-bold text-[var(--sidebar-text)]'
                    : 'font-normal text-[var(--sidebar-muted)] hover:border-[#7FA6BC] hover:bg-[rgba(250,237,205,0.08)] hover:text-[var(--sidebar-text)]'
                )}
              >
                {collapsed ? <Mail size={15} /> : (
                  <>
                    <span className="flex-1 truncate">{group.label}</span>
                    <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                  </>
                )}
              </button>
              {isOpen && !collapsed && (
                <div className="border-t border-[var(--sidebar-border)] bg-[rgba(250,237,205,0.06)] pb-1">
                  {group.children.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      indent
                      active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="mx-3 mb-4 border-t border-[var(--sidebar-border)] pt-3 text-left text-xs text-[#7FA6BC] hover:text-[var(--sidebar-text)]"
        >
          Collapse sidebar
        </button>
      )}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mx-auto mb-4 text-[#7FA6BC] hover:text-[var(--sidebar-text)]"
          title="Expand sidebar"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </aside>
  );

  const mobileSidebar = !embed && (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-[rgba(0,48,73,0.45)] lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--sidebar-border)] px-7 py-6">
          <div>
            <div className="font-[family-name:var(--font-display)] text-[17px] font-bold">Tenant Report</div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#7FA6BC]">Growth Studio</div>
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} className="text-[#7FA6BC]">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV[0].children.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={pathname === item.href}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>
      </aside>
    </>
  );

  return (
    <NewsletterProviders>
      {embed && <HideNextDevIndicator />}
      <div className="flex min-h-screen bg-[var(--background)]">
        {sidebar}
        {mobileSidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          {!embed && (
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 lg:hidden">
              <button type="button" onClick={() => setMobileOpen(true)} className="text-[var(--primary)]" aria-label="Open menu">☰</button>
              <span className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--primary)]">Newsletter</span>
            </header>
          )}
          <EditorialShellGutter className="flex-1 overflow-auto" as="main">
            <div className="editorial-page mx-auto w-full pb-16 md:pb-24">
              {children}
            </div>
          </EditorialShellGutter>
        </div>
      </div>
    </NewsletterProviders>
  );
}

export function NewsletterVoiceShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
