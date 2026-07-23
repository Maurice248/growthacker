'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Shield, User, X } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import type { ModuleStatus } from '@/lib/company-module-status';
import { ClientDashboardNav } from '@/components/client-dashboard/client-dashboard-nav';
import { stopImpersonating } from '@/lib/admin-impersonate';

type ClientDashboardShellProps = {
  companyName: string;
  logoUrl: string | null;
  userName: string | null;
  userEmail: string;
  integrationsConfigured: boolean;
  moduleStatuses: ModuleStatus[];
  isAppAdmin?: boolean;
  isImpersonating?: boolean;
  children: React.ReactNode;
};

const STORAGE_KEY = 'client_dashboard_sidebar_collapsed';

function SidebarBrand({
  companyName,
  logoUrl,
  collapsed,
}: {
  companyName: string;
  logoUrl: string | null;
  collapsed: boolean;
}) {
  const logo = logoUrl ? (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-sm">
      <Image
        src={logoUrl}
        alt={`${companyName} logo`}
        fill
        className="object-contain p-0.5"
        unoptimized
      />
    </div>
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-slate-900 text-sm font-bold text-white shadow-sm">
      {companyName.charAt(0).toUpperCase()}
    </div>
  );

  if (collapsed) {
    return logo;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {logo}
      <div className="min-w-0">
        <div className="truncate font-[family-name:var(--font-display)] text-[17px] font-bold leading-tight tracking-tight text-[var(--sidebar-text)]">
          {companyName}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7FA6BC]">
          Growthacker
        </div>
      </div>
    </div>
  );
}

function AdminBanner({
  companyName,
  isImpersonating,
  onExitImpersonation,
}: {
  companyName: string;
  isImpersonating: boolean;
  onExitImpersonation: () => void;
}) {
  if (isImpersonating) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900">
        <span>
          Viewing as <strong>{companyName}</strong> — platform admin mode
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-md px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
          >
            Admin portal
          </Link>
          <button
            type="button"
            onClick={onExitImpersonation}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
          >
            <X className="h-3 w-3" />
            Exit view-as
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>
        Platform admin — no company selected. Tabs are unlocked with placeholder data.
      </span>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
      >
        <Shield className="h-3 w-3" />
        Admin portal
      </Link>
    </div>
  );
}

export function ClientDashboardShell({
  companyName,
  logoUrl,
  userName,
  userEmail,
  integrationsConfigured,
  moduleStatuses,
  isAppAdmin = false,
  isImpersonating = false,
  children,
}: ClientDashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { update } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const profileActive =
    pathname === '/client-dashboard/profile' ||
    pathname === '/client-dashboard/security' ||
    pathname === '/client-dashboard/apis' ||
    pathname === '/client-dashboard/members';

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const displayName = userName?.trim() || userEmail.split('@')[0] || 'User';

  const openProfile = () => {
    setMobileOpen(false);
    router.push('/client-dashboard/profile');
  };

  const handleExitImpersonation = async () => {
    await stopImpersonating(update);
    router.push('/admin');
  };

  const sidebarContent = (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-[var(--sidebar-border)] pb-3.5',
          collapsed ? 'justify-center' : 'justify-between gap-2'
        )}
      >
        <div className={cn('flex min-w-0 items-center', collapsed ? 'justify-center w-full' : 'flex-1 gap-2')}>
          <SidebarBrand companyName={companyName} logoUrl={logoUrl} collapsed={collapsed} />
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Collapse sidebar"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--sidebar-border)] bg-[rgba(250,237,205,0.08)] text-[11px] text-[var(--sidebar-muted)] transition-colors hover:bg-[rgba(250,237,205,0.16)] hover:text-[var(--sidebar-text)]"
          >
            ‹
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Expand sidebar"
          className="mx-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--sidebar-border)] bg-[rgba(250,237,205,0.08)] text-[11px] text-[var(--sidebar-muted)] transition-colors hover:bg-[rgba(250,237,205,0.16)] hover:text-[var(--sidebar-text)]"
        >
          ›
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ClientDashboardNav
          collapsed={collapsed}
          integrationsConfigured={integrationsConfigured}
          moduleStatuses={moduleStatuses}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      <div className="shrink-0 border-t border-[var(--sidebar-border)] pt-3">
        <div className="flex flex-col gap-2">
          {isAppAdmin && !collapsed && (
            <Link
              href="/admin"
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-violet-200 bg-violet-50 px-2 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
            >
              <Shield size={13} />
              Admin portal
            </Link>
          )}
          <button
            type="button"
            onClick={openProfile}
            title={collapsed ? 'View profile' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-none border border-transparent text-left transition-colors hover:bg-[rgba(250,237,205,0.08)]',
              collapsed ? 'justify-center p-1.5' : 'px-1.5 py-1.5',
              profileActive && 'border-[var(--sidebar-border)] bg-[rgba(250,237,205,0.12)]'
            )}
          >
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 border-[#1A4A66] bg-[#669BBC] text-[#FDF0D5]">
              <User size={13} />
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[13.5px] font-bold text-[var(--sidebar-text)]">{displayName}</div>
                  <div className="truncate text-[12px] text-[#7FA6BC]">{userEmail}</div>
                </div>
                <ChevronRight size={14} className="shrink-0 text-[#7FA6BC]" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/client-login' })}
            title={collapsed ? 'Sign Out' : undefined}
            className="flex w-full items-center justify-center gap-1.5 rounded-none border-b border-[#33607C] bg-transparent px-2 py-2 text-[12.5px] font-semibold text-[#7FA6BC] transition-colors hover:border-[var(--sidebar-text)] hover:text-[var(--sidebar-text)]"
          >
            <LogOut size={13} />
            {!collapsed && 'Sign Out'}
          </button>
          <p
            className={cn(
              '-mt-0.5 mb-0 text-center font-medium leading-tight text-[#7FA6BC]',
              collapsed ? 'text-[9px]' : 'text-[10px]'
            )}
          >
            {collapsed ? 'v0.3' : 'version 0.3'}
          </p>
        </div>
      </div>
    </>
  );

  const brandMark = logoUrl ? (
    <div className="relative h-8 w-8 overflow-hidden rounded-md border border-[var(--border)] bg-white">
      <Image src={logoUrl} alt={`${companyName} logo`} fill className="object-contain p-0.5" unoptimized />
    </div>
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
      {companyName.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col gap-5 overflow-y-auto overflow-x-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] transition-[width,padding] duration-250 ease-out lg:flex',
          collapsed ? 'w-[68px] px-2.5 py-8' : 'w-[224px] px-3 py-8'
        )}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[224px] flex-col gap-5 overflow-y-auto border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 py-8 text-[var(--sidebar-text)] shadow-lg transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
            aria-label="Open menu"
          >
            ☰
          </button>
          {brandMark}
          <span className="truncate text-sm font-bold text-[var(--text)]">{companyName}</span>
        </header>

        {isAppAdmin && (
          <AdminBanner
            companyName={companyName}
            isImpersonating={isImpersonating}
            onExitImpersonation={handleExitImpersonation}
          />
        )}

        <main
          className={cn(
            'editorial-shell-main flex min-h-0 flex-1 flex-col overflow-auto',
            pathname.startsWith('/client-dashboard/workspace/')
              ? 'p-0'
              : 'editorial-shell-gutter'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
