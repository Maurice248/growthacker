export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, slug: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    await logAdminAction({
      actorUserId: admin.id,
      action: 'impersonate.start',
      targetType: 'company',
      targetId: company.id,
      metadata: { companyName: company.name },
    });

    return NextResponse.json({
      ok: true,
      companyId: company.id,
      companyName: company.name,
    });
  } catch (err) {
    console.error('[admin/impersonate POST]', err);
    return NextResponse.json({ error: 'Failed to start impersonation.' }, { status: 500 });
  }
}

export async function DELETE() {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await logAdminAction({
    actorUserId: admin.id,
    action: 'impersonate.end',
    targetType: 'session',
    targetId: admin.id,
  });

  return NextResponse.json({ ok: true });
}
