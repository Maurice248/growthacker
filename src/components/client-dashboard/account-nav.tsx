'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KeyRound, Plug, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const BASE_NAV_ITEMS = [
  { href: '/client-dashboard/profile', label: 'Profile', icon: User },
  { href: '/client-dashboard/security', label: 'Security', icon: KeyRound },
  { href: '/client-dashboard/apis', label: 'API key management', icon: Plug },
] as const;

const ADMIN_NAV_ITEM = { href: '/client-dashboard/members', label: 'Members', icon: Users } as const;

type AccountNavProps = {
  isAdmin?: boolean;
  className?: string;
};

export function AccountNav({ isAdmin = false, className }: AccountNavProps) {
  const pathname = usePathname();
  const navItems = isAdmin
    ? [BASE_NAV_ITEMS[0], ADMIN_NAV_ITEM, BASE_NAV_ITEMS[1], BASE_NAV_ITEMS[2]]
    : [...BASE_NAV_ITEMS];

  return (
    <nav className={cn('w-full shrink-0 lg:sticky lg:top-8 lg:w-52', className)}>
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="shrink-0 lg:shrink">
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-[var(--primary-light)] text-[var(--primary-dark)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                )}
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
