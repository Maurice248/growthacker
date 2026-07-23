'use client';

import { Suspense, useEffect } from 'react';
import { notifyParentEmbedNavigate } from '@/lib/client-dashboard-nav';
import { AppSectionProvider } from '@/lib/app-section';
import { HideNextDevIndicator } from '@/components/HideNextDevIndicator';
import { EditorialShellGutter } from '@/components/editorial/editorial-shell-gutter';
import { EditorialPageShell } from '@/components/outreach/page-body';

function OutreachShellInner({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (window.parent === window) return;

      const anchor = (event.target as Element | null)?.closest('a[href^="/outreach"]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;

      const href = anchor.getAttribute('href');
      if (!href || href.includes('embed=1')) return;

      event.preventDefault();
      const url = new URL(href, window.location.origin);
      // Sync parent sidebar when the target maps to a tab; always navigate inside the
      // iframe too — parent only remounts the iframe when the tab id changes (e.g.
      // /outreach/campaigns/new → /outreach/campaigns stays on outreach-campaigns).
      notifyParentEmbedNavigate(url.pathname);
      url.searchParams.set('embed', '1');
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return (
    <AppSectionProvider section="outreach">
      <HideNextDevIndicator />
      <div className="min-h-screen bg-[var(--background)]">
        <EditorialShellGutter>
          <EditorialPageShell>{children}</EditorialPageShell>
        </EditorialShellGutter>
      </div>
    </AppSectionProvider>
  );
}

export function OutreachShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <OutreachShellInner>{children}</OutreachShellInner>
    </Suspense>
  );
}
