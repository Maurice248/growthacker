'use client';

import { useAppSection } from '@/lib/app-section';
import { EditorialPageHeader } from '@/components/editorial/editorial-layout';
import { editorialPageShellClass, useEditorialPageShell } from '@/components/outreach/page-body';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  description?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function Header({ title, description, eyebrow, actions, className }: HeaderProps) {
  const { section } = useAppSection();
  const inShell = useEditorialPageShell();
  const defaultEyebrow =
    section === 'dashboard' ? 'Dashboard' : section === 'outreach' ? 'Cold Email' : undefined;

  const header = (
    <EditorialPageHeader
      eyebrow={eyebrow ?? defaultEyebrow}
      title={title}
      subtitle={description}
      actions={actions}
      className={cn('mb-10', className)}
    />
  );

  if (inShell) return header;

  return <div className={editorialPageShellClass}>{header}</div>;
}
