import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { AccountPage } from '@/components/client-dashboard/account-page';
import { IntegrationsForm } from '@/components/client-dashboard/integrations-form';

export default async function ClientApisPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = isCompanyAdminRole(session?.user?.role);

  return (
    <AccountPage
      title="API key management"
      description="Connect Meta Ads, WordPress, DataForSEO, and third-party API tokens for your company workspace."
    >
      <IntegrationsForm readOnly={!isAdmin} />
    </AccountPage>
  );
}
