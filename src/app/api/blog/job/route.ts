export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { advanceBlogJob, getBlogJobView } from '@/lib/blog/generate';

export async function GET(request: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = await getBlogJobView(jobId, companyId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(request: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  let jobId = '';
  try {
    const body = await request.json();
    jobId = String(body.jobId || '').trim();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const result = await advanceBlogJob(companyId, jobId);

    if (result.busy || (result.job.status !== 'done' && result.job.status !== 'error')) {
      return NextResponse.json({
        job: result.job,
        pending: true,
        busy: Boolean(result.busy),
      });
    }

    if (result.job.status === 'error') {
      return NextResponse.json(
        { job: result.job, error: result.job.errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({ job: result.job });
  } catch (error) {
    console.error('[API blog/job POST]', error);
    const message = error instanceof Error ? error.message : 'Failed to process blog job';

    if (message.includes('Job not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (jobId) {
      const job = await getBlogJobView(jobId, companyId);
      if (job && job.status !== 'done' && job.status !== 'error') {
        return NextResponse.json({ job, pending: true });
      }
      if (job?.status === 'error') {
        return NextResponse.json({ job, error: job.errorMessage }, { status: 500 });
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
