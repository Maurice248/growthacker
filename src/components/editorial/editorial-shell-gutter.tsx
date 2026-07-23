'use client';

import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

type EditorialShellGutterProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'main' | 'div';
};

/** Outer page gutter — horizontal padding outside the max-width editorial column. */
export function EditorialShellGutter({
  children,
  className,
  as: Tag = 'main',
}: EditorialShellGutterProps) {
  const embed = useSearchParams().get('embed') === '1';

  return (
    <Tag
      className={cn('editorial-shell-main editorial-shell-gutter', className)}
      data-embed={embed ? 'true' : undefined}
    >
      {children}
    </Tag>
  );
}
