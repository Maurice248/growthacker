'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CLIENT_HOME_TAB_ID } from '@/lib/client-dashboard-nav';
import { moduleForTab } from '@/lib/company-module-status';
import { useModuleStatuses } from '@/components/client-dashboard/module-status-context';

function tabFromPathname(pathname: string): string | null {
  return pathname.match(/\/client-dashboard\/workspace\/([^/]+)$/)?.[1] ?? null;
}

/**
 * Workspace route helpers. The persistent main-app iframe lives in
 * ClientDashboardShell so Ads Library scrapes survive Dashboard / Configuration /
 * Settings / Profile navigation.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const moduleStatuses = useModuleStatuses();
  const tabId = tabFromPathname(pathname);
  const moduleId = tabId ? moduleForTab(tabId) : null;
  const moduleStatus = moduleId ? moduleStatuses.find((m) => m.id === moduleId) : null;
  const isHiddenModule = moduleStatus?.enabled === false;

  useEffect(() => {
    if (!isHiddenModule || !tabId) return;
    router.replace(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`, { scroll: false });
  }, [isHiddenModule, tabId, router]);

  if (isHiddenModule) return null;

  return <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>;
}
