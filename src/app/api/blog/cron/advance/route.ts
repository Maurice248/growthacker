export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  advanceBlogJob,
  BLOG_PHASE_BUDGET_MS,
} from '@/lib/blog/generate';
import {
  abandonStaleBlogJobs,
  listAdvanceableBlogJobs,
} from '@/lib/blog/jobs';
import type { BlogJobStatus } from '@/lib/blog/types';

const WORKER_BUDGET_MS = 280_000;
const DEFAULT_PHASE_BUDGET_MS = 90_000;
const JOB_BATCH_LIMIT = 5;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const abandoned = await abandonStaleBlogJobs();
    const jobs = await listAdvanceableBlogJobs(JOB_BATCH_LIMIT);

    const results: Array<{
      jobId: string;
      companyId: string;
      fromStatus: string;
      toStatus?: string;
      busy?: boolean;
      advanced?: boolean;
      skipped?: boolean;
      reason?: string;
      error?: string;
    }> = [];

    for (const job of jobs) {
      const elapsed = Date.now() - startedAt;
      const remaining = WORKER_BUDGET_MS - elapsed;
      const status = job.status as BlogJobStatus;
      const phaseBudget = BLOG_PHASE_BUDGET_MS[status] ?? DEFAULT_PHASE_BUDGET_MS;

      if (remaining < phaseBudget) {
        results.push({
          jobId: job.id,
          companyId: job.companyId,
          fromStatus: job.status,
          skipped: true,
          reason: 'Insufficient remaining worker budget for phase',
        });
        break;
      }

      try {
        const result = await advanceBlogJob(job.companyId, job.id);
        results.push({
          jobId: job.id,
          companyId: job.companyId,
          fromStatus: job.status,
          toStatus: result.job.status,
          busy: result.busy,
          advanced: result.advanced,
        });
      } catch (error) {
        results.push({
          jobId: job.id,
          companyId: job.companyId,
          fromStatus: job.status,
          error: error instanceof Error ? error.message : 'Advance failed',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      abandoned,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('[API blog/cron/advance]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron advance failed' },
      { status: 500 }
    );
  }
}
