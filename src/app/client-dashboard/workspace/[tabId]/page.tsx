import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import {
  CLIENT_ALL_TAB_IDS,
  CLIENT_BRAND_CONTEXT_TAB_ID,
} from '@/lib/client-dashboard-nav';
import { moduleForTab } from '@/lib/company-module-status';
import { ClientTabView } from '@/components/client-dashboard/client-tab-view';

export default async function ClientWorkspaceTabPage({
  params,
}: {
  params: Promise<{ tabId: string }>;
}) {
  const { tabId } = await params;

  if (!CLIENT_ALL_TAB_IDS.has(tabId)) {
    redirect(`/client-dashboard/workspace/${CLIENT_BRAND_CONTEXT_TAB_ID}`);
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/client-login');
  }

  if (session.user.isAppAdmin) {
    return <ClientTabView tabId={tabId} />;
  }

  if (!session.user.companyId) {
    redirect('/client-login');
  }

  if (tabId !== CLIENT_BRAND_CONTEXT_TAB_ID) {
    const { modules } = await getCompanyIntegrationStatus(session.user.companyId);
    const moduleId = moduleForTab(tabId);
    const allowed = moduleId
      ? modules.find((m) => m.id === moduleId)?.configured === true
      : modules.some((m) => m.configured);

    if (!allowed) {
      redirect(`/client-dashboard/workspace/${CLIENT_BRAND_CONTEXT_TAB_ID}`);
    }
  }

  return <ClientTabView tabId={tabId} />;
}
