'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TAB_META = {
  profile: {
    href: '/client-dashboard/profile',
    label: 'Profile',
    title: 'Profile',
    subtitle: 'Your account and company details.',
  },
  members: {
    href: '/client-dashboard/members',
    label: 'Members',
    title: 'Members',
    subtitle: 'Invite teammates and manage who has access to your company workspace.',
  },
  security: {
    href: '/client-dashboard/security',
    label: 'Security',
    title: 'Security',
    subtitle: 'Manage your password and account security.',
  },
  api: {
    href: '/client-dashboard/apis',
    label: 'API Keys',
    title: 'API Keys',
    subtitle:
      'Connect Meta Ads, WordPress, DataForSEO, and third-party API tokens for your workspace.',
  },
} as const;

type TabId = keyof typeof TAB_META;

function tabFromPath(pathname: string): TabId {
  if (pathname.startsWith('/client-dashboard/members')) return 'members';
  if (pathname.startsWith('/client-dashboard/security')) return 'security';
  if (pathname.startsWith('/client-dashboard/apis')) return 'api';
  return 'profile';
}

type AccountSettingsShellProps = {
  isAdmin?: boolean;
  children: React.ReactNode;
};

export function AccountSettingsShell({ isAdmin = false, children }: AccountSettingsShellProps) {
  const pathname = usePathname();
  const activeTab = tabFromPath(pathname);
  const meta = TAB_META[activeTab];

  const tabs: { id: TabId; label: string; href: string }[] = isAdmin
    ? [
        { id: 'profile', ...TAB_META.profile },
        { id: 'members', ...TAB_META.members },
        { id: 'security', ...TAB_META.security },
        { id: 'api', ...TAB_META.api },
      ]
    : [
        { id: 'profile', ...TAB_META.profile },
        { id: 'security', ...TAB_META.security },
        { id: 'api', ...TAB_META.api },
      ];

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <header className="mb-9">
        <div className="mb-2.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Settings
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-[34px] font-bold leading-[1.1] tracking-[-0.8px] text-[var(--text)]">
          {meta.title}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B7A6E]">{meta.subtitle}</p>
      </header>

      <nav className="mb-2 flex flex-wrap gap-7 border-b border-[var(--primary)]">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                '-mb-px border-b-2 pb-3 text-sm transition-colors',
                active
                  ? 'border-[var(--red)] font-bold text-[var(--red)]'
                  : 'border-transparent font-normal text-[#4A5A64] hover:border-[#C2B79A] hover:text-[var(--primary)]'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="min-w-0">{children}</div>

      <div className="mt-14 text-xs text-[#B0A88F]">version 0.2</div>
    </div>
  );
}
