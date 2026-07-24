import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CLIENT_HOME_TAB_ID } from '@/lib/client-dashboard-nav';

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

  redirect(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`);
}
