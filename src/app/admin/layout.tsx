import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isAppAdminRole } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isAppAdminRole(session.user.role)) {
    redirect('/client-login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <AdminSidebar
        userEmail={session.user.email ?? ''}
        userName={session.user.name ?? null}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
