import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import {
  CLIENT_ALL_TAB_IDS,
  CLIENT_CONFIGURATION_IDS,
  CLIENT_HOME_TAB_ID,
} from '@/lib/client-dashboard-nav';
import { moduleForTab } from '@/lib/company-module-status';
import { ClientTabView } from '@/components/client-dashboard/client-tab-view';
import { HomeDashboard } from '@/components/client-dashboard/home-dashboard';
import { getHomeDashboardOverviews } from '@/lib/home-dashboard-data';

export default async function ClientWorkspaceTabPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const { tabId } = await params;

  if (!CLIENT_ALL_TAB_IDS.has(tabId)) {
    redirect(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/client-login');
  }

  if (session.user.isAppAdmin && !session.user.isImpersonating) {
    if (tabId === CLIENT_HOME_TAB_ID) {
      const displayName =
        session.user.name?.trim() || session.user.email?.split('@')[0] || 'User';
      const overviews = await getHomeDashboardOverviews(null, session.user.id);
      return <HomeDashboard userName={displayName} overviews={overviews} />;
    }
    return <ClientTabView tabId={tabId} />;
  }

  if (!session.user.companyId) {
    redirect('/client-login');
  }

  if (!CLIENT_CONFIGURATION_IDS.has(tabId) && tabId !== CLIENT_HOME_TAB_ID) {
    const companyId = session.user.companyId!;
    const { modules } = await getCompanyIntegrationStatus(companyId);
    const moduleId = moduleForTab(tabId);
    const status = moduleId ? modules.find((m) => m.id === moduleId) : null;

    if (status && !status.enabled) {
      redirect(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`);
    }

    if (moduleId && status?.accessible !== true) {
      redirect(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`);
    }
  }

  if (tabId === CLIENT_HOME_TAB_ID) {
    const displayName =
      session.user.name?.trim() || session.user.email?.split('@')[0] || 'User';
    const overviews = await getHomeDashboardOverviews(
      session.user.companyId!,
      session.user.id
    );
    return <HomeDashboard userName={displayName} overviews={overviews} />;
  }

  return <ClientTabView tabId={tabId} />;
}
