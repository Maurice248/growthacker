export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const automations = await prisma.adAutomation.findMany({
      where: { companyId },
      include: {
        variants: {
          orderBy: [{ generation: 'desc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ automations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list automations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
