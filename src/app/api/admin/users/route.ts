export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || undefined;

  const users = await prisma.user.findMany({
    where: companyId ? { companyId } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      createdAt: true,
      company: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      companyId: u.companyId,
      companyName: u.company?.name ?? null,
      companySlug: u.company?.slug ?? null,
      createdAt: u.createdAt.toISOString(),
    }))
  );
}
