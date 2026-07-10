import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { AccountNav } from '@/components/client-dashboard/account-nav';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const isAdmin = isCompanyAdminRole(session?.user?.role);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,48rem)] lg:items-start lg:gap-x-10">
        <AccountNav isAdmin={isAdmin} className="order-2 lg:col-start-1 lg:row-start-2" />
        {children}
      </div>
    </div>
  );
}
