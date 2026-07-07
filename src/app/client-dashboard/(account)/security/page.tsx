import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ChangeEmailForm } from '@/components/client-dashboard/change-email-form';
import { ChangePasswordForm } from '@/components/client-dashboard/change-password-form';

export default async function ClientSecurityPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/client-login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (!user) {
    redirect('/client-login');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Security</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Manage your password and account security.</p>
      </div>

      <ChangeEmailForm currentEmail={user.email} />
      <ChangePasswordForm />
    </div>
  );
}
