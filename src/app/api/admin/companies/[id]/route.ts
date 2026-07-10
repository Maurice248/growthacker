export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import { computeCompanyHealth } from '@/lib/admin/company-health';
import { logAdminAction } from '@/lib/admin/audit';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      invites: {
        where: { acceptedAt: null },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      brandConfig: { select: { id: true, updatedAt: true } },
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  }

  const { configured, modules } = await getCompanyIntegrationStatus(id);
  const health = await computeCompanyHealth(id);

  return NextResponse.json({
    id: company.id,
    name: company.name,
    slug: company.slug,
    logoUrl: company.logoUrl,
    onboardingCompletedAt: company.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    integrationsConfigured: configured,
    moduleStatuses: modules,
    hasBrandConfig: Boolean(company.brandConfig),
    brandConfigUpdatedAt: company.brandConfig?.updatedAt.toISOString() ?? null,
    users: company.users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
    pendingInvites: company.invites.map((i) => ({
      ...i,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
    health,
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : undefined;

    if (!name && !slug) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    if (slug) {
      const existing = await prisma.company.findFirst({
        where: { slug, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Slug already in use.' }, { status: 409 });
      }
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
      },
    });

    await logAdminAction({
      actorUserId: admin.id,
      action: 'company.update',
      targetType: 'company',
      targetId: id,
      metadata: { name: updated.name, slug: updated.slug },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
    });
  } catch (err) {
    console.error('[admin/companies PATCH]', err);
    return NextResponse.json({ error: 'Failed to update company.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await prisma.company.delete({ where: { id } });

    await logAdminAction({
      actorUserId: admin.id,
      action: 'company.delete',
      targetType: 'company',
      targetId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/companies DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete company.' }, { status: 500 });
  }
}
