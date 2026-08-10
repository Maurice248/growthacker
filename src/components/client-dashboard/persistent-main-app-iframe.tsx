'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT,
  CLIENT_DASHBOARD_NAVIGATE_EVENT,
  CLIENT_DASHBOARD_SET_TAB_EVENT,
  CREATE_AD_GEN_SESSION_KEY,
  isMainAppEmbedTab,
} from '@/lib/client-dashboard-nav';
import { moduleForTab } from '@/lib/company-module-status';
import { useModuleStatuses } from '@/components/client-dashboard/module-status-context';

function tabFromPathname(pathname: string): string | null {
  return pathname.match(/\/client-dashboard\/workspace\/([^/]+)$/)?.[1] ?? null;
}

/**
 * Keeps the main-app embed (`/?embed=1`) alive across the whole client-dashboard
 * shell — including Dashboard, Configuration, Settings, and Profile — so in-flight
 * Ads Library scrapes / Create Ad jobs are not torn down on route change.
 */
export function PersistentMainAppIframe({
  visible,
}: {
  /** When true, iframe fills the content area; otherwise it stays mounted but visually hidden. */
  visible: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const moduleStatuses = useModuleStatuses();
  const tabId = tabFromPathname(pathname);
  const isMainApp = tabId ? isMainAppEmbedTab(tabId) : false;
  const moduleId = tabId ? moduleForTab(tabId) : null;
  const moduleStatus = moduleId ? moduleStatuses.find((m) => m.id === moduleId) : null;
  const isHiddenModule = moduleStatus?.enabled === false;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** First main-app tab visited — src stays fixed so we never reload mid-job */
  const [iframeBootTab, setIframeBootTab] = useState<string | null>(null);
  const lastSentTabRef = useRef<string | null>(null);

  const showVisible = visible && isMainApp && !isHiddenModule;

  useEffect(() => {
    if (showVisible && tabId) {
      setIframeBootTab((prev) => prev ?? tabId);
    }
  }, [showVisible, tabId]);

  // Resume after Settings/Profile if a background job flagged the session
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CREATE_AD_GEN_SESSION_KEY) === '1') {
        setIframeBootTab((prev) => prev ?? 'ads_library');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const iframeMounted = iframeBootTab !== null;

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
        try {
          if (event.data.active) {
            sessionStorage.setItem(CREATE_AD_GEN_SESSION_KEY, '1');
            setIframeBootTab((prev) => prev ?? 'ads_library');
          } else {
            sessionStorage.removeItem(CREATE_AD_GEN_SESSION_KEY);
          }
        } catch {
          /* ignore */
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

  if (!iframeMounted || !iframeSrc) return null;

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      title="Main app"
      className={
        showVisible
          ? 'relative z-0 h-full min-h-0 w-full flex-1 border-none bg-[var(--bg)]'
          : 'pointer-events-none fixed bottom-0 right-0 z-0 h-px w-px overflow-hidden border-none opacity-[0.01]'
      }
      aria-hidden={!showVisible}
      onLoad={() => {
        if (tabId && isMainApp) sendTabToIframe(tabId);
      }}
    />
  );
}

/** Whether the shell should show the main-app iframe (and hide route children). */
export function useMainAppIframeVisible(): boolean {
  const pathname = usePathname();
  const moduleStatuses = useModuleStatuses();
  const tabId = tabFromPathname(pathname);
  if (!tabId || !isMainAppEmbedTab(tabId)) return false;
  const moduleId = moduleForTab(tabId);
  const moduleStatus = moduleId ? moduleStatuses.find((m) => m.id === moduleId) : null;
  if (moduleStatus?.enabled === false) return false;
  return true;
}
