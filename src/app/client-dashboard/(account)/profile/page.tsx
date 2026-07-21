import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isCompanyAdminRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CompanyProfileForm } from '@/components/client-dashboard/company-profile-form';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialStatusPill,
} from '@/app/components';
import { EditorialSectionHeader } from '@/components/editorial/editorial-layout';

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
    <>
      <section>
        <div className="pb-3.5 pt-7 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--red)]">
          Account
        </div>
        <EditorialDefinitionList>
          <EditorialDefinitionRow label="Identity">
            <div className="flex items-center gap-4">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] font-[family-name:var(--font-display)] text-[17px] font-bold text-[#FAEDCD]">
                {initials(displayName)}
              </div>
              <div>
                <div className="font-[family-name:var(--font-display)] text-[17px] font-bold text-[var(--primary)]">
                  {displayName}
                </div>
                <div className="mt-1">
                  <EditorialStatusPill variant={isAdmin ? 'danger' : 'neutral'}>
                    {roleLabel(user.role)}
                  </EditorialStatusPill>
                </div>
              </div>
            </div>
          </EditorialDefinitionRow>
          <EditorialDefinitionRow label="Login" isLast>
            <div className="flex flex-wrap items-baseline gap-4">
              <div className="min-w-[240px] flex-1">
                <div className="text-[15px] text-[var(--text)]">{user.email}</div>
                <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                  Member since {formatDate(user.createdAt)}
                </div>
              </div>
              <Link
                href="/client-dashboard/security"
                className="text-sm font-bold text-[var(--primary)] underline decoration-[#C2B79A] underline-offset-4 transition-colors hover:text-[var(--red)] hover:decoration-[var(--red)]"
              >
                Change credentials
              </Link>
            </div>
          </EditorialDefinitionRow>
        </EditorialDefinitionList>
      </section>

      <section className="mt-10">
        <EditorialSectionHeader title="Company" meta="Name and logo for the dashboard" />
        <CompanyProfileForm readOnly={!isAdmin} />
      </section>
    </>
  );
}
