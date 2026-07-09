export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runGenerate } from '@/lib/newsletter/generate';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const service = String(body.service || '').trim();
    const topic = String(body.topic || '').trim();

    if (!service || !topic) {
      return NextResponse.json({ error: 'service and topic are required' }, { status: 400 });
    }

    const data = await runGenerate(companyId, service, topic);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[newsletter/generate]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
