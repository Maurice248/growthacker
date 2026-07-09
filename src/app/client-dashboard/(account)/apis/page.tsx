import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { IntegrationsForm } from '@/components/client-dashboard/integrations-form';

export default async function ClientApisPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = isCompanyAdminRole(session?.user?.role);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">API key management</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Connect Meta Ads, WordPress, DataForSEO, and third-party API tokens for your
          company workspace.
        </p>
      </div>

      <IntegrationsForm readOnly={!isAdmin} />
    </div>
  );
}
