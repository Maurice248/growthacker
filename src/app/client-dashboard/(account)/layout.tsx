import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { AccountSettingsShell } from '@/components/client-dashboard/account-settings-shell';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const isAdmin = isCompanyAdminRole(session?.user?.role);

  return <AccountSettingsShell isAdmin={isAdmin}>{children}</AccountSettingsShell>;
}
