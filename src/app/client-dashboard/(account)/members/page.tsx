import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { MembersManager } from '@/components/client-dashboard/members-manager';

export default async function ClientMembersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.companyId) {
    redirect('/client-login');
  }

  if (!isCompanyAdminRole(session.user.role)) {
    redirect('/client-dashboard/profile');
  }

  return <MembersManager currentUserId={session.user.id} />;
}
