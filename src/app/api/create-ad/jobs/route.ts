export const dynamic = 'force-dynamic';
export const maxDuration = 800;

import { after, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  createCreateAdJob,
  getActiveCreateAdJob,
  getCreateAdJob,
  type CreateAdJobKind,
} from '@/lib/create-ad/jobs';
import { executeCreateAdJob } from '@/lib/create-ad/execute-job';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const kind = body.kind as CreateAdJobKind;
    const payload = body.payload ?? body;

    if (!kind || !['prompts', 'video', 'image'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be prompts, video, or image' }, { status: 400 });
    }

    const existing = await getActiveCreateAdJob(companyId);
    if (existing) {
      return NextResponse.json(
        { error: 'A Create Ad job is already running', jobId: existing.id, status: existing.status },
        { status: 409 }
      );
    }

    const job = await createCreateAdJob(companyId, kind, payload);

    after(async () => {
      try {
        await executeCreateAdJob(job.id);
      } catch (err) {
        console.error('[create-ad/jobs POST after]', job.id, err);
      }
    });

    return NextResponse.json({ jobId: job.id, status: job.status, kind: job.kind });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start Create Ad job';
    console.error('[create-ad/jobs POST]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const active = searchParams.get('active');

    if (jobId) {
      const job = await getCreateAdJob(jobId, companyId);
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      return NextResponse.json({ job });
    }

    if (active === '1') {
      const job = await getActiveCreateAdJob(companyId);
      return NextResponse.json({ job });
    }

    return NextResponse.json({ error: 'jobId or active=1 is required' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
