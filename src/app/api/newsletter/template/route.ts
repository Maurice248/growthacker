export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { createNewsletterTemplate } from '@/lib/newsletter/html';
import { prisma } from '@/lib/prisma';
import type { NewsletterData } from '@/lib/newsletter/types';

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const templates = await prisma.newsletterTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        service: true,
        topic: true,
        subjectLine: true,
        preheader: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list templates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const content = (body.content || {}) as NewsletterData;
    const service = String(body.service || '').trim();
    const topic = String(body.topic || '').trim();

    if (!content || !service || !topic) {
      return NextResponse.json({ error: 'content, service, and topic are required' }, { status: 400 });
    }

    const result = await createNewsletterTemplate(companyId, content, service, topic);

    return NextResponse.json({
      templateId: result.templateId,
      'template id': result.templateId,
      template_id: result.templateId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Template creation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[newsletter/template]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
