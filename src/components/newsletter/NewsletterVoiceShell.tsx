'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  PenLine,
  Megaphone,
  History,
  Settings,
  Mail,
  ChevronRight,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewsletterProviders } from '@/components/newsletter/Providers';
import { HideNextDevIndicator } from '@/components/HideNextDevIndicator';

const NAV = [
  {
    label: 'Newsletter',
    icon: Mail,
    children: [
      { label: 'Dashboard', href: '/newsletter/dashboard', icon: LayoutDashboard },
      { label: 'Settings', href: '/newsletter/overview', icon: SlidersHorizontal },
      { label: 'Generate Newsletter', href: '/newsletter/generate', icon: PenLine },
      { label: 'Create Campaign', href: '/newsletter/campaign', icon: Megaphone },
      { label: 'Subscribers', href: '/newsletter/subscribers', icon: Users },
      { label: 'History', href: '/newsletter/history', icon: History },
      { label: 'Manage Services', href: '/newsletter/services', icon: Settings },
    ],
  },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const embed = searchParams.get('embed') === '1';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Newsletter: true,
  });

  useEffect(() => {
    if (!embed) return;

    const handler = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href^="/newsletter"]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;

      const href = anchor.getAttribute('href');
      if (!href || href.includes('embed=1')) return;

      event.preventDefault();
      const url = new URL(href, window.location.origin);
      url.searchParams.set('embed', '1');
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [embed]);

  const sidebar = (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64',
        embed ? 'hidden' : 'hidden lg:flex min-h-screen'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-3">
        {!collapsed && (
          <Image src="/tenant-report-logo.png" alt="Tenant Report AI" width={120} height={34} className="h-[34px] w-auto" />
        )}
        <button
          type="button"
          title="Collapse sidebar"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', !collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroups[group.label] ?? true;
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !isOpen }))}
                className={cn(
                  'group flex w-full items-center rounded-lg text-sm font-medium text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700',
                  collapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                )}
              >
                <span className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
                  <GroupIcon className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-indigo-600" />
                  {!collapsed && group.label}
                </span>
                {!collapsed && (
                  <ChevronRight className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-90')} />
                )}
              </button>
              {isOpen && !collapsed && (
                <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-3">
                  {group.children.map((item) => {
                    const ItemIcon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-indigo-50 font-semibold text-indigo-700'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                        )}
                      >
                        <ItemIcon className={cn('h-4 w-4 shrink-0', active ? 'text-indigo-600' : 'text-gray-400')} />
                        {item.label}
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );

  const mobileSidebar = !embed && (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <Image src="/tenant-report-logo.png" alt="Tenant Report AI" width={120} height={36} className="h-9 w-auto" />
          <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-gray-400">
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.label}>
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{group.label}</p>
              {group.children.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
                      active ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-gray-500'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );

  return (
    <NewsletterProviders>
      {embed && <HideNextDevIndicator />}
      <div className="flex min-h-screen bg-gray-50">
        {sidebar}
        {mobileSidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          {!embed && (
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Open menu"
              >
                ☰
              </button>
              <Image src="/tenant-report-logo.png" alt="Tenant Report AI" width={100} height={32} className="h-8 w-auto" />
            </header>
          )}
          <main className="flex-1 overflow-auto p-4 lg:p-8">
            <div
              style={{
                width: '100%',
                maxWidth: 1400,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </NewsletterProviders>
  );
}

export function NewsletterVoiceShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
