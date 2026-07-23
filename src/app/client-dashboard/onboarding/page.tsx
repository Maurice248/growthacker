import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import { CLIENT_HOME_TAB_ID } from '@/lib/client-dashboard-nav';
import { OnboardingWizard } from '@/components/client-dashboard/onboarding-wizard';

export default async function ClientOnboardingPage() {
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
  });

  if (!company) {
    redirect('/client-login');
  }

  if (company.onboardingCompletedAt) {
    redirect('/client-dashboard');
  }

  const { modules } = await getCompanyIntegrationStatus(session.user.companyId);

  return (
    <OnboardingWizard initialCompanyName={company.name} modules={modules} />
  );
}
