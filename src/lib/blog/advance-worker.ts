import { advanceBlogJob, BLOG_PHASE_BUDGET_MS } from '@/lib/blog/generate';
import {
  abandonStaleBlogJobs,
  listAdvanceableBlogJobs,
} from '@/lib/blog/jobs';
import type { BlogJobStatus } from '@/lib/blog/types';

const DEFAULT_PHASE_BUDGET_MS = 90_000;
const DEFAULT_JOB_BATCH_LIMIT = 5;
const IMAGE_SOFT_WAIT_MS = 15_000;

export type BlogAdvanceWorkerResult = {
  abandoned: number;
  processed: number;
  results: Array<{
    jobId: string;
    companyId: string;
    fromStatus: string;
    toStatus?: string;
    busy?: boolean;
    advanced?: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
  }>;
};

/**
 * Advance active blog jobs within a wall-clock budget.
 * Used by the daily generate cron (Hobby-safe) and optional manual /cron/advance.
 * Soft-waits on kie.ai image rendering by sleeping and retrying until budget runs out.
 */
export async function runBlogAdvanceWorker(options?: {
  workerBudgetMs?: number;
  jobBatchLimit?: number;
  startedAt?: number;
}): Promise<BlogAdvanceWorkerResult> {
  const workerBudgetMs = options?.workerBudgetMs ?? 280_000;
  const jobBatchLimit = options?.jobBatchLimit ?? DEFAULT_JOB_BATCH_LIMIT;
  const startedAt = options?.startedAt ?? Date.now();

  const abandoned = await abandonStaleBlogJobs();
  const results: BlogAdvanceWorkerResult['results'] = [];

  while (Date.now() - startedAt < workerBudgetMs) {
    const remainingAtLoop = workerBudgetMs - (Date.now() - startedAt);
    if (remainingAtLoop < 20_000) break;

    const jobs = await listAdvanceableBlogJobs(jobBatchLimit);
    if (jobs.length === 0) break;

    let sawImageSoftWait = false;
    let advancedNonImage = false;

    for (const job of jobs) {
      const elapsed = Date.now() - startedAt;
      const remaining = workerBudgetMs - elapsed;
      const status = job.status as BlogJobStatus;
      const phaseBudget = BLOG_PHASE_BUDGET_MS[status] ?? DEFAULT_PHASE_BUDGET_MS;

      if (remaining < Math.min(phaseBudget, 45_000)) {
        results.push({
          jobId: job.id,
          companyId: job.companyId,
          fromStatus: job.status,
          skipped: true,
          reason: 'Insufficient remaining worker budget for phase',
        });
        return { abandoned, processed: results.length, results };
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

        if (result.job.status === 'image') {
          sawImageSoftWait = true;
        } else if (result.advanced && result.job.status !== 'error') {
          advancedNonImage = true;
        }
      } catch (error) {
        results.push({
          jobId: job.id,
          companyId: job.companyId,
          fromStatus: job.status,
          error: error instanceof Error ? error.message : 'Advance failed',
        });
      }
    }

    const stillWaiting = await listAdvanceableBlogJobs(1);
    if (stillWaiting.length === 0) break;

    // Image renders asynchronously — pause before another poll instead of spinning.
    if (sawImageSoftWait && !advancedNonImage) {
      const remaining = workerBudgetMs - (Date.now() - startedAt);
      if (remaining < IMAGE_SOFT_WAIT_MS + 20_000) break;
      await new Promise((resolve) => setTimeout(resolve, IMAGE_SOFT_WAIT_MS));
    }
  }

  return { abandoned, processed: results.length, results };
}
