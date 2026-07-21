export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

function parseSubscriberRow(row: Record<string, unknown>, companyId: string) {
  const email = String(row.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;

  return {
    companyId,
    email,
    firstName: String(row.firstName || row.first_name || '').trim(),
    lastName: String(row.lastName || row.last_name || '').trim(),
    serviceType: String(row.serviceType || row.service_type || '').trim(),
    status: 'subscribed',
    emailStatus: 'verified',
  };
}

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const counts = await prisma.newsletterSubscriber.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    });

    return NextResponse.json({ subscribers, counts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load subscribers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();

    if (Array.isArray(body.subscribers)) {
      const rows = body.subscribers
        .map((row: Record<string, unknown>) => parseSubscriberRow(row, companyId))
        .filter(Boolean) as Array<ReturnType<typeof parseSubscriberRow> & object>;

      if (rows.length === 0) {
        return NextResponse.json({ error: 'No valid subscriber rows found. Each line needs a valid email.' }, { status: 400 });
      }

      let created = 0;
      for (const row of rows) {
        await prisma.newsletterSubscriber.upsert({
          where: { companyId_email: { companyId, email: row!.email } },
          create: row!,
          update: {
            firstName: row!.firstName,
            lastName: row!.lastName,
            serviceType: row!.serviceType,
            status: 'subscribed',
            emailStatus: 'verified',
          },
        });
        created += 1;
      }

      return NextResponse.json({ imported: created });
    }

    const row = parseSubscriberRow(body, companyId);
    if (!row) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { companyId_email: { companyId, email: row.email } },
      create: row,
      update: {
        firstName: row.firstName,
        lastName: row.lastName,
        serviceType: row.serviceType,
        status: 'subscribed',
        emailStatus: 'verified',
      },
    });

    return NextResponse.json({ subscriber });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save subscriber';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.newsletterSubscriber.deleteMany({
      where: { id, companyId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete subscriber';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
