export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { runRegenerate } from '@/lib/newsletter/generate';
import type { NewsletterData } from '@/lib/newsletter/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const service = String(body.service || '').trim();
    const topic = String(body.topic || '').trim();
    const retryPrompt = String(body.retryPrompt || '').trim();
    const previousContent = (body.previousContent || {}) as NewsletterData;

    if (!service || !topic || !retryPrompt) {
      return NextResponse.json(
        { error: 'service, topic, and retryPrompt are required' },
        { status: 400 }
      );
    }

    const data = await runRegenerate(companyId, service, topic, retryPrompt, previousContent);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Regeneration failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[newsletter/regenerate]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
