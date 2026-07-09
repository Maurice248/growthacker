'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CLIENT_DASHBOARD_NAVIGATE_EVENT,
  CLIENT_DASHBOARD_SET_TAB_EVENT,
  isMainAppEmbedTab,
} from '@/lib/client-dashboard-nav';

function tabFromPathname(pathname: string): string | null {
  return pathname.match(/\/client-dashboard\/workspace\/([^/]+)$/)?.[1] ?? null;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabId = tabFromPathname(pathname);
  const isMainApp = tabId ? isMainAppEmbedTab(tabId) : false;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Capture the very first tabId so the iframe starts on the right tab without a second load
  const initialTabRef = useRef<string | null>(tabId);
  const lastSentTabRef = useRef<string | null>(null);

  const sendTabToIframe = useCallback((tab: string) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: CLIENT_DASHBOARD_SET_TAB_EVENT, tabId: tab },
      window.location.origin
    );
    lastSentTabRef.current = tab;
  }, []);

  // When we navigate to a different main-app tab, tell the iframe
  useEffect(() => {
    if (!isMainApp || !tabId) return;
    if (tabId === lastSentTabRef.current) return;
    sendTabToIframe(tabId);
    // Retry once after a tick in case the iframe just finished loading
    const t = setTimeout(() => {
      if (tabId !== lastSentTabRef.current) sendTabToIframe(tabId);
    }, 350);
    return () => clearTimeout(t);
  }, [isMainApp, tabId, sendTabToIframe]);

  // Receive navigate events from the embedded app (e.g. "Create ad based on this analysis")
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== CLIENT_DASHBOARD_NAVIGATE_EVENT) return;
      const newTabId = event.data?.tabId as string | undefined;
      if (!newTabId) return;
      const target = `/client-dashboard/workspace/${newTabId}`;
      if (pathname !== target) router.replace(target, { scroll: false });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pathname, router]);

  const iframeSrc = `/?embed=1&tab=${initialTabRef.current ?? 'overview'}`;

  return (
    <div className="flex h-[calc(100dvh)] min-h-0 flex-1 flex-col">
      {/*
        Persistent iframe for all main-app tabs (Ads Lab, Create Ad, Overview, etc.).
        Lives here in the layout so it NEVER unmounts during workspace navigation — no flash, no reload.
        We send postMessage to switch tabs instead of changing src.
      */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Main app"
        style={{ display: isMainApp ? 'block' : 'none', flex: 1, minHeight: 0 }}
        className="h-full w-full border-none bg-[var(--bg)]"
        onLoad={() => {
          if (isMainApp && tabId) sendTabToIframe(tabId);
        }}
      />
      {/* Non-main-app tabs (Newsletter, Cold Email, Blog) rendered by page.tsx */}
      {!isMainApp && children}
    </div>
  );
}
