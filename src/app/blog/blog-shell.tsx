'use client';

import { Suspense, useEffect } from 'react';
import { notifyParentEmbedNavigate } from '@/lib/client-dashboard-nav';
import { HideNextDevIndicator } from '@/components/HideNextDevIndicator';
import { EditorialShellGutter } from '@/components/editorial/editorial-shell-gutter';

function BlogShellInner({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (window.parent === window) return;

      const anchor = (event.target as Element | null)?.closest('a[href^="/blog"]');
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
  }, []);

  return (
    <>
      <HideNextDevIndicator />
      <div className="min-h-screen bg-[var(--background)]">
        <EditorialShellGutter>{children}</EditorialShellGutter>
      </div>
    </>
  );
}

export function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <BlogShellInner>{children}</BlogShellInner>
    </Suspense>
  );
}
