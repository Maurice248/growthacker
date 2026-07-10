import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { MembersManager } from '@/components/client-dashboard/members-manager';
import { AccountPage } from '@/components/client-dashboard/account-page';

export default async function ClientMembersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.companyId) {
    redirect('/client-login');
  }

  if (!isCompanyAdminRole(session.user.role)) {
    redirect('/client-dashboard/profile');
  }

  return (
    <AccountPage
      title="Members"
      description="Invite teammates and manage who has access to your company workspace."
    >
      <MembersManager currentUserId={session.user.id} />
    </AccountPage>
  );
}
