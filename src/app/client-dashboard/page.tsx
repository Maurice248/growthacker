import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { companyHasIntegrationsConfigured } from '@/lib/company-integration-status';
import { CLIENT_BRAND_CONTEXT_TAB_ID, CLIENT_HOME_TAB_ID } from '@/lib/client-dashboard-nav';

export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/client-login');
  }

  if (session.user.isAppAdmin) {
    redirect(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`);
  }

  if (!session.user.companyId) {
    redirect('/client-login');
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { onboardingCompletedAt: true },
  });

  if (!company?.onboardingCompletedAt) {
    redirect('/client-dashboard/onboarding');
  }

  const configured = await companyHasIntegrationsConfigured(session.user.companyId);
  redirect(
    configured
      ? `/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`
      : `/client-dashboard/workspace/${CLIENT_BRAND_CONTEXT_TAB_ID}`
  );
}
