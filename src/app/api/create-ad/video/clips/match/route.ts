export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { attachVideoUrlsToScenes } from '@/lib/create-ad/video/clips';
import type { KieTaskResult, VideoScene } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;
    void companyId;

    const body = await request.json();
    const scenes = (body.scenes || []) as VideoScene[];
    const tasks = (body.tasks || []) as Array<{ taskId: string; sceneIndex: number }>;
    const pollResults = (body.pollResults || []) as KieTaskResult[];

    const updated = attachVideoUrlsToScenes(scenes, tasks, pollResults);
    return NextResponse.json({ scenes: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scene video match failed';
    console.error('[create-ad/video/clips/match]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
