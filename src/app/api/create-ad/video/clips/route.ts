export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { createSceneVideoTasks } from '@/lib/create-ad/video/clips';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import type { VideoScene } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const scenes = (body.scenes || []) as VideoScene[];

    if (!scenes.length) {
      return NextResponse.json({ error: 'scenes array is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    const tasks = await createSceneVideoTasks(tokens, scenes);

    return NextResponse.json({ tasks, scenes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scene video task creation failed';
    const status = message.includes('not configured') ? 503 : 500;
    console.error('[create-ad/video/clips]', err);
    return NextResponse.json({ error: message }, { status });
  }
}
