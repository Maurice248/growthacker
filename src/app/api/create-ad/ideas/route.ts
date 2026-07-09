export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { generateIdeas } from '@/lib/create-ad/ideas';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { AdItemInput } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const item = body as AdItemInput & { brand_config?: unknown };

    if (!item?.id || !item?.type) {
      return NextResponse.json({ error: 'id and type are required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const result = await generateIdeas(companyId, tokens, item, item.brand_config);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Idea generation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/ideas]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
