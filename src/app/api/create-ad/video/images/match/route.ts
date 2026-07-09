export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { matchImageResultsToScenes } from '@/lib/create-ad/video/images';
import type { KieTaskResult, VideoScene } from '@/lib/create-ad/types';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;
    void companyId;

    const body = await request.json();
    const scenes = (body.scenes || []) as VideoScene[];
    const pollResults = (body.pollResults || []) as KieTaskResult[];
    const taskPrompts = (body.taskPrompts || []) as string[];

    const updated = matchImageResultsToScenes(scenes, pollResults, taskPrompts);
    return NextResponse.json({ scenes: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Scene image match failed';
    console.error('[create-ad/video/images/match]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
