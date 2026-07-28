export const dynamic = 'force-dynamic';
export const maxDuration = 800;

import { after, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  createSocialBackgroundJob,
  getActiveSocialBackgroundJob,
  getSocialJob,
  mergeSocialJobInput,
  updateSocialJob,
  type SocialStudioBackgroundKind,
} from '@/lib/social-studio/jobs';
import { executeSocialStudioJob } from '@/lib/social-studio/execute-job';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const kind = body.kind as SocialStudioBackgroundKind;
    const payload = (body.payload ?? body) as Record<string, unknown>;

    if (!kind || !['image', 'video', 'video_render'].includes(kind)) {
      return NextResponse.json(
        { error: 'kind must be image, video, or video_render' },
        { status: 400 }
      );
    }

    const existing = await getActiveSocialBackgroundJob(companyId);
    if (existing) {
      return NextResponse.json(
        {
          error: 'A Creator Studio job is already running',
          jobId: existing.id,
          status: existing.status,
        },
        { status: 409 }
      );
    }

    if (kind === 'video_render') {
      const existingJobId = String(payload.jobId || '').trim();
      if (!existingJobId) {
        return NextResponse.json({ error: 'jobId is required for video_render' }, { status: 400 });
      }
      const existingJob = await getSocialJob(existingJobId, companyId);
      if (!existingJob) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      await updateSocialJob(existingJobId, companyId, {
        status: 'pending',
        error: null,
        input: mergeSocialJobInput(existingJob.input, {
          ...payload,
          backgroundJob: true,
          runStatus: 'pending',
          backgroundKind: 'video_render',
        }),
      });
      after(async () => {
        try {
          await executeSocialStudioJob(existingJobId);
        } catch (err) {
          console.error('[social-studio/jobs POST after]', existingJobId, err);
        }
      });
      return NextResponse.json({
        jobId: existingJobId,
        status: 'pending',
        kind: existingJob.kind,
      });
    }

    const job = await createSocialBackgroundJob(companyId, kind, payload);

    after(async () => {
      try {
        await executeSocialStudioJob(job.id);
      } catch (err) {
        console.error('[social-studio/jobs POST after]', job.id, err);
      }
    });

    return NextResponse.json({ jobId: job.id, status: job.status, kind: job.kind });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start Creator Studio job';
    console.error('[social-studio/jobs POST]', err);
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
      const job = await getSocialJob(jobId, companyId);
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      return NextResponse.json({ job });
    }

    if (active === '1') {
      const job = await getActiveSocialBackgroundJob(companyId);
      return NextResponse.json({ job });
    }

    return NextResponse.json({ error: 'jobId or active=1 is required' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
