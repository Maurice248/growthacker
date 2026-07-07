import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompanyProfileForm } from '@/components/client-dashboard/company-profile-form';

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function roleLabel(role: string) {
  return isCompanyAdminRole(role) ? 'Admin' : 'Member';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function ClientProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/client-login');
  }

  if (session.user.isAppAdmin && !session.user.companyId) {
    redirect('/admin');
  }

  if (!session.user.companyId) {
    redirect('/client-login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      company: { select: { id: true } },
    },
  });

  if (!user?.company) {
    redirect('/client-login');
  }

  const displayName = user.name?.trim() || user.email.split('@')[0];
  const isAdmin = isCompanyAdminRole(user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Profile</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Your account and company details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>Personal information for your login.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[var(--primary-mid)] bg-[var(--primary-light)] text-lg font-bold text-[var(--primary)]">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-[var(--text)]">{displayName}</p>
              <Badge variant="outline" className="mt-1">
                {roleLabel(user.role)}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2 text-sm text-[var(--text-body)]">
                  <Mail className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">{user.email}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Member since {formatDate(user.createdAt)}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/client-dashboard/security">Change Credentials</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CompanyProfileForm readOnly={!isAdmin} />
    </div>
  );
}
