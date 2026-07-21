'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import { useAppSection } from '@/lib/app-section';

export function Sidebar() {
  const pathname = usePathname();
  const { basePath, homeHref, showLogo, navItems } = useAppSection();

  return (
    <div className="flex h-full w-56 flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] transition-all duration-200">
      {showLogo && (
        <div className="flex items-center gap-3 border-b border-[var(--sidebar-border)] px-5 py-8">
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg">
            <Image
              src="/tenant-report-logo.png"
              alt="Tenant Report AI"
              fill
              className="object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight text-[var(--sidebar-text)]">
              Tenant Report
            </span>
            <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-[#7FA6BC]">
              Growthacker
            </span>
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-3 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7FA6BC]">
          Main Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === basePath
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center border-l-2 px-4 py-2 text-[15px] transition-all duration-150',
                isActive
                  ? 'border-[var(--sidebar-active-border)] bg-[rgba(250,237,205,0.12)] font-bold text-[var(--sidebar-text)]'
                  : 'border-transparent font-normal text-[var(--sidebar-muted)] hover:border-[#7FA6BC] hover:bg-[rgba(250,237,205,0.08)] hover:text-[var(--sidebar-text)]'
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] p-3">
        <Link
          href={homeHref}
          className="flex items-center gap-2 border-b border-[#33607C] px-3 py-2.5 text-sm font-medium text-[#7FA6BC] transition-all hover:border-[var(--sidebar-text)] hover:text-[var(--sidebar-text)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Main Dashboard
        </Link>
      </div>
    </div>
  );
}
