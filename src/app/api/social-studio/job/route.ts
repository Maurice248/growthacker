export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { getSocialJob, getLatestSocialJob, getLatestPipelineStatus } from '@/lib/social-studio/jobs';

export async function GET(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const kind = searchParams.get('kind') as 'image' | 'video' | null;
    const latest = searchParams.get('latest');

    if (jobId) {
      const job = await getSocialJob(jobId, companyId);
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      return NextResponse.json({ job });
    }

    if (latest === 'status') {
      const status = await getLatestPipelineStatus(companyId);
      return NextResponse.json({ status });
    }

    const job = await getLatestSocialJob(companyId, kind || undefined);
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
