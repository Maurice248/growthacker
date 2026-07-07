export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, invites: true, executions: true } },
      integration: { select: { id: true } },
      brandConfig: { select: { id: true } },
    },
  });

  const rows = await Promise.all(
    companies.map(async (c) => {
      const { configured, modules } = await getCompanyIntegrationStatus(c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logoUrl,
        onboardingCompletedAt: c.onboardingCompletedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        userCount: c._count.users,
        pendingInviteCount: c._count.invites,
        executionCount: c._count.executions,
        hasIntegrationRow: Boolean(c.integration),
        hasBrandConfig: Boolean(c.brandConfig),
        integrationsConfigured: configured,
        moduleStatuses: modules.map((m) => ({
          id: m.id,
          label: m.label,
          configured: m.configured,
        })),
      };
    })
  );

  return NextResponse.json(rows);
}
