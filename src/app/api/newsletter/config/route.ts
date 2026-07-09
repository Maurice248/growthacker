export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  getNewsletterConfig,
  resolveNewsletterContext,
  upsertNewsletterConfig,
} from '@/lib/newsletter/company-context';

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const [config, context] = await Promise.all([
      getNewsletterConfig(companyId),
      resolveNewsletterContext(companyId),
    ]);

    return NextResponse.json({ config, context });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load config';
    console.error('[newsletter/config]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const config = await upsertNewsletterConfig(companyId, {
      fromEmail: body.fromEmail,
      fromName: body.fromName,
      replyTo: body.replyTo,
      website: body.website,
      logoUrl: body.logoUrl,
      addressLine: body.addressLine,
      phone: body.phone,
      unsubscribeBaseUrl: body.unsubscribeBaseUrl,
      sendHour: body.sendHour !== undefined ? Number(body.sendHour) : undefined,
      sendMinute: body.sendMinute !== undefined ? Number(body.sendMinute) : undefined,
      sendTimezone: body.sendTimezone,
      dailyLimit: body.dailyLimit !== undefined ? Number(body.dailyLimit) : undefined,
      active: body.active,
    });

    return NextResponse.json({ config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
