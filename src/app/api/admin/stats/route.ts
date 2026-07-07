export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { APP_ADMIN_ROLE, COMPANY_ADMIN_ROLE, COMPANY_MEMBER_ROLE, requireAppAdmin } from '@/lib/auth';
import { companyHasIntegrationsConfigured } from '@/lib/company-integration-status';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [companyCount, userCount, appAdminCount, companyAdminCount, memberCount, recentUsers, recentCompanies] =
    await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: APP_ADMIN_ROLE } }),
      prisma.user.count({ where: { role: COMPANY_ADMIN_ROLE } }),
      prisma.user.count({ where: { role: COMPANY_MEMBER_ROLE } }),
      prisma.user.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          company: { select: { name: true } },
        },
      }),
      prisma.company.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      }),
    ]);

  const companies = await prisma.company.findMany({ select: { id: true } });
  let configuredCount = 0;
  await Promise.all(
    companies.map(async (c) => {
      if (await companyHasIntegrationsConfigured(c.id)) configuredCount += 1;
    })
  );

  return NextResponse.json({
    stats: {
      companyCount,
      userCount,
      appAdminCount,
      companyAdminCount,
      memberCount,
      companiesWithIntegrations: configuredCount,
      companiesWithoutIntegrations: companyCount - configuredCount,
    },
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      companyName: u.company?.name ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    recentCompanies: recentCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      userCount: c._count.users,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
