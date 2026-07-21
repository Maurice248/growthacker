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
    <>
      <ChangeEmailForm currentEmail={user.email} />
      <ChangePasswordForm />
    </>
  );
}
