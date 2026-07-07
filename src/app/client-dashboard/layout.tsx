import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import { ClientDashboardShell } from '@/components/client-dashboard/client-dashboard-shell';
import { ClientDashboardSessionProvider } from '@/components/client-dashboard/client-dashboard-session-provider';

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.companyId) {
    redirect('/client-login');
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
  });

  if (!company) {
    redirect('/client-login');
  }

  const { configured: integrationsConfigured, modules } = await getCompanyIntegrationStatus(
    session.user.companyId
  );

  return (
    <ClientDashboardSessionProvider session={session}>
      <ClientDashboardShell
        companyName={company.name}
        logoUrl={company.logoUrl}
        userName={session.user.name ?? null}
        userEmail={session.user.email ?? ''}
        integrationsConfigured={integrationsConfigured}
        moduleStatuses={modules}
      >
        {children}
      </ClientDashboardShell>
    </ClientDashboardSessionProvider>
  );
}
