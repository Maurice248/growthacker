'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Activity,
  Building2,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Shield,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Control panel', icon: LayoutDashboard, exact: true },
  { href: '/admin/operations', label: 'Operations', icon: Workflow },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { href: '/admin/onboarding', label: 'Onboarding', icon: UserPlus },
  { href: '/admin/usage', label: 'Usage', icon: TrendingUp },
  { href: '/admin/activity', label: 'Activity log', icon: Activity },
];

type AdminSidebarProps = {
  userEmail: string;
  userName: string | null;
};

export function AdminSidebar({ userEmail, userName }: AdminSidebarProps) {
  const pathname = usePathname();
  const displayName = userName?.trim() || userEmail.split('@')[0] || 'Admin';

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white shadow-sm">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-zinc-900">
              Platform Admin
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-amber-700/80">
              Internal console
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Sections
        </p>
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200/80'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isActive ? 'text-amber-600' : 'text-zinc-400 group-hover:text-zinc-600'
                    )}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-zinc-100 p-3">
        <Link
          href="/client-dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
        >
          <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          Client dashboard
        </Link>
        <div className="rounded-md bg-zinc-50 px-3 py-2.5">
          <div className="truncate text-xs font-medium text-zinc-800">{displayName}</div>
          <div className="truncate text-[11px] text-zinc-500">{userEmail}</div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/client-login' })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
