import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { IntegrationsForm } from '@/components/client-dashboard/integrations-form';

export default async function ClientApisPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = isCompanyAdminRole(session?.user?.role);

  return <IntegrationsForm readOnly={!isAdmin} />;
}
