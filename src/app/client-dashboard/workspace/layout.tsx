'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CLIENT_BRAND_CONTEXT_TAB_ID,
  CLIENT_DASHBOARD_NAVIGATE_EVENT,
  CLIENT_DASHBOARD_SET_TAB_EVENT,
  isMainAppEmbedTab,
} from '@/lib/client-dashboard-nav';
import { moduleForTab } from '@/lib/company-module-status';
import { useModuleStatuses } from '@/components/client-dashboard/module-status-context';

function tabFromPathname(pathname: string): string | null {
  return pathname.match(/\/client-dashboard\/workspace\/([^/]+)$/)?.[1] ?? null;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const moduleStatuses = useModuleStatuses();
  const tabId = tabFromPathname(pathname);
  const isMainApp = tabId ? isMainAppEmbedTab(tabId) : false;
  const moduleId = tabId ? moduleForTab(tabId) : null;
  const moduleStatus = moduleId ? moduleStatuses.find((m) => m.id === moduleId) : null;
  const isHiddenModule = moduleStatus?.enabled === false;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialTabRef = useRef<string | null>(tabId);
  const lastSentTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isHiddenModule || !tabId) return;
    router.replace(`/client-dashboard/workspace/${CLIENT_BRAND_CONTEXT_TAB_ID}`, { scroll: false });
  }, [isHiddenModule, tabId, router]);

  const sendTabToIframe = useCallback((tab: string) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: CLIENT_DASHBOARD_SET_TAB_EVENT, tabId: tab },
      window.location.origin
    );
    lastSentTabRef.current = tab;
  }, []);

  useEffect(() => {
    if (!isMainApp || isHiddenModule || !tabId) return;
    if (tabId === lastSentTabRef.current) return;
    sendTabToIframe(tabId);
    const t = setTimeout(() => {
      if (tabId !== lastSentTabRef.current) sendTabToIframe(tabId);
    }, 350);
    return () => clearTimeout(t);
  }, [isMainApp, isHiddenModule, tabId, sendTabToIframe]);

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

  const iframeSrc = `/?embed=1&tab=${initialTabRef.current ?? CLIENT_BRAND_CONTEXT_TAB_ID}`;
  const showMainIframe = isMainApp && !isHiddenModule;

  return (
    <div className="flex h-[calc(100dvh)] min-h-0 flex-1 flex-col">
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Main app"
        style={{ display: showMainIframe ? 'block' : 'none', flex: 1, minHeight: 0 }}
        className="h-full w-full border-none bg-[var(--bg)]"
        onLoad={() => {
          if (showMainIframe && tabId) sendTabToIframe(tabId);
        }}
      />
      {!isMainApp && !isHiddenModule && children}
    </div>
  );
}
