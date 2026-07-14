export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import { generateVariantAdCopy } from '@/lib/meta-automation/ad-copy';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const base = body.base as {
      name?: string;
      primary_text?: string;
      description?: string;
      headline?: string;
    };
    const variants = (body.variants || []) as Array<{
      id: string;
      label?: string;
      angle?: string;
      idea?: string;
    }>;

    if (!base?.name?.trim() || !base?.primary_text?.trim()) {
      return NextResponse.json(
        { error: 'Base ad name and primary text are required' },
        { status: 400 }
      );
    }

    if (!variants.length) {
      return NextResponse.json({ copies: {} });
    }

    const tokens = await getCreateAdTokens(companyId);
    const copies = await generateVariantAdCopy(
      companyId,
      tokens,
      {
        name: String(base.name).trim(),
        primary_text: String(base.primary_text).trim(),
        description: String(base.description || '').trim(),
        headline: base.headline ? String(base.headline).trim() : undefined,
      },
      variants.map((v, index) => ({
        id: String(v.id),
        label: v.label || `AI variant ${index + 1}`,
        angle: v.angle,
        idea: v.idea,
      }))
    );

    return NextResponse.json({ copies });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate ad copy';
    console.error('[meta/automation/generate-ad-copy]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
