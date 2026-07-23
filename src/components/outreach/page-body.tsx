'use client';

import { createContext, useContext } from 'react';
import { useAppSection } from '@/lib/app-section';
import { cn } from '@/lib/utils';

export const editorialPageShellClass =
  'editorial-page-shell mx-auto w-full';

const EditorialPageShellContext = createContext(false);

export function useEditorialPageShell() {
  return useContext(EditorialPageShellContext);
}

/** Single centered column for page header + body (matches editorial v4 layout). */
export function EditorialPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <EditorialPageShellContext.Provider value={true}>
      <div className={cn('editorial-page-shell mx-auto w-full', className)}>
        {children}
      </div>
    </EditorialPageShellContext.Provider>
  );
}

export function getPageBodyClass(section: 'dashboard' | 'outreach', extra?: string, inShell = false) {
  return cn(
    'editorial-page-body',
    section === 'outreach' ? 'space-y-12' : 'space-y-8',
    !inShell && editorialPageShellClass,
    extra
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { section } = useAppSection();
  const inShell = useEditorialPageShell();
  return <div className={getPageBodyClass(section, className, inShell)}>{children}</div>;
}

/** Flat editorial panel — no card box/shadow */
export const outreachCardClass = 'rounded-none border-0 border-t border-[var(--border)] bg-transparent shadow-none';
