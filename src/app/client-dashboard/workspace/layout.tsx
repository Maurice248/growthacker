'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT,
  CLIENT_DASHBOARD_NAVIGATE_EVENT,
  CLIENT_DASHBOARD_SET_TAB_EVENT,
  CLIENT_HOME_TAB_ID,
  CREATE_AD_GEN_SESSION_KEY,
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
  /** First main-app tab visited — iframe src is fixed for the session so we never reload mid-generation */
  const [iframeBootTab, setIframeBootTab] = useState<string | null>(null);
  const lastSentTabRef = useRef<string | null>(null);

  const showMainIframeVisible = isMainApp && !isHiddenModule;

  useEffect(() => {
    if (showMainIframeVisible && tabId) {
      setIframeBootTab((prev) => prev ?? tabId);
    }
  }, [showMainIframeVisible, tabId]);

  const iframeMounted = iframeBootTab !== null;

  useEffect(() => {
    if (!isHiddenModule || !tabId) return;
    router.replace(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`, { scroll: false });
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
    if (!isMainApp || isHiddenModule || !tabId || !iframeMounted) return;
    if (tabId === lastSentTabRef.current) return;
    sendTabToIframe(tabId);
    const t = setTimeout(() => {
      if (tabId !== lastSentTabRef.current) sendTabToIframe(tabId);
    }, 350);
    return () => clearTimeout(t);
  }, [isMainApp, isHiddenModule, tabId, sendTabToIframe, iframeMounted]);

  useEffect(() => {
    if (!iframeMounted) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT) {
        if (event.data.active) {
          sessionStorage.setItem(CREATE_AD_GEN_SESSION_KEY, '1');
        } else {
          sessionStorage.removeItem(CREATE_AD_GEN_SESSION_KEY);
        }
        return;
      }

      if (event.data?.type !== CLIENT_DASHBOARD_NAVIGATE_EVENT) return;
      const newTabId = event.data?.tabId as string | undefined;
      if (!newTabId) return;
      const target = `/client-dashboard/workspace/${newTabId}`;
      if (pathname !== target) router.replace(target, { scroll: false });
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pathname, router, iframeMounted]);

  const iframeSrc = iframeBootTab ? `/?embed=1&tab=${iframeBootTab}` : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {iframeMounted && iframeSrc ? (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Main app"
          className={
            showMainIframeVisible
              ? 'relative z-0 h-full min-h-0 w-full flex-1 border-none bg-[var(--bg)]'
              : 'pointer-events-none fixed bottom-0 right-0 z-0 h-px w-px overflow-hidden border-none opacity-[0.01]'
          }
          aria-hidden={!showMainIframeVisible}
          onLoad={() => {
            if (tabId && isMainApp) sendTabToIframe(tabId);
          }}
        />
      ) : null}
      {!isMainApp && !isHiddenModule ? (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col bg-[var(--bg)]">{children}</div>
      ) : null}
    </div>
  );
}
