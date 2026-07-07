export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  APP_ADMIN_ROLE,
  COMPANY_ADMIN_ROLE,
  COMPANY_MEMBER_ROLE,
  isAssignableRole,
  isLastAppAdmin,
  requireAppAdmin,
} from '@/lib/auth';
import { isLastCompanyAdmin } from '@/lib/company-members';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const roleInput = typeof body.role === 'string' ? body.role : undefined;
    const companyIdInput =
      body.companyId === null
        ? null
        : typeof body.companyId === 'string'
          ? body.companyId.trim()
          : undefined;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, companyId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const data: { role?: string; companyId?: string | null } = {};

    if (roleInput !== undefined) {
      if (!isAssignableRole(roleInput)) {
        return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
      }

      if (user.role === APP_ADMIN_ROLE && roleInput !== APP_ADMIN_ROLE) {
        if (await isLastAppAdmin(id)) {
          return NextResponse.json(
            { error: 'Cannot demote the last platform admin.' },
            { status: 400 }
          );
        }
      }

      if (
        user.companyId &&
        user.role === COMPANY_ADMIN_ROLE &&
        roleInput === COMPANY_MEMBER_ROLE
      ) {
        if (await isLastCompanyAdmin(user.companyId, id)) {
          return NextResponse.json(
            { error: 'Cannot demote the last company admin.' },
            { status: 400 }
          );
        }
      }

      data.role = roleInput;

      if (roleInput === APP_ADMIN_ROLE) {
        data.companyId = null;
      }
    }

    if (companyIdInput !== undefined && (roleInput ?? user.role) !== APP_ADMIN_ROLE) {
      if (companyIdInput) {
        const company = await prisma.company.findUnique({ where: { id: companyIdInput } });
        if (!company) {
          return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
        }
      }
      data.companyId = companyIdInput;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
        company: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      companyId: updated.companyId,
      companyName: updated.company?.name ?? null,
      companySlug: updated.company?.slug ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error('[admin/users PATCH]', err);
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  if (id === admin.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, companyId: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  if (user.role === APP_ADMIN_ROLE && (await isLastAppAdmin(id))) {
    return NextResponse.json({ error: 'Cannot delete the last platform admin.' }, { status: 400 });
  }

  if (
    user.companyId &&
    user.role === COMPANY_ADMIN_ROLE &&
    (await isLastCompanyAdmin(user.companyId, id))
  ) {
    return NextResponse.json({ error: 'Cannot delete the last company admin.' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
