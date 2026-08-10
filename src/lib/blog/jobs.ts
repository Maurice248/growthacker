import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { BlogJobStatus, BlogJobView } from './types';

/** Lease longer than the largest phase budget so a live worker isn't reclaimed mid-phase. */
export const BLOG_JOB_LEASE_MS = 6 * 60 * 1000;
export const BLOG_JOB_MAX_PHASE_ATTEMPTS = 3;
export const BLOG_JOB_ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;
export const BLOG_IMAGE_WAIT_MAX_MS = 30 * 60 * 1000;

export const BLOG_ACTIVE_STATUSES: BlogJobStatus[] = [
  'pending',
  'keywords',
  'outline',
  'writing',
  'image_prompt',
  'image',
  'publishing',
];

export type BlogJobInput = Record<string, unknown> & {
  _lease?: { at: string };
  _attempts?: Partial<Record<BlogJobStatus, number>>;
  _imageWaitStartedAt?: string;
  _scheduled?: boolean;
};

export function parseBlogJobInput(input: unknown): BlogJobInput {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return { ...(input as Record<string, unknown>) } as BlogJobInput;
  }
  return {};
}

function leaseAgeMs(input: BlogJobInput, now = Date.now()): number | null {
  const at = input._lease?.at;
  if (!at) return null;
  const ts = Date.parse(at);
  if (!Number.isFinite(ts)) return null;
  return now - ts;
}

export function isBlogJobLeaseExpired(input: BlogJobInput, now = Date.now()): boolean {
  const age = leaseAgeMs(input, now);
  if (age === null) return true;
  return age >= BLOG_JOB_LEASE_MS;
}

export async function createBlogJob(
  companyId: string,
  categoryId: string | null,
  input: Prisma.InputJsonValue = {}
) {
  return prisma.blogJob.create({
    data: {
      companyId,
      categoryId,
      status: 'pending',
      input,
    },
  });
}

export async function updateBlogJob(
  jobId: string,
  companyId: string,
  data: {
    status?: BlogJobStatus;
    title?: string | null;
    slug?: string | null;
    articleHtml?: string | null;
    imagePrompt?: string | null;
    imageTaskId?: string | null;
    imageUrl?: string | null;
    wordpressPostId?: number | null;
    wordpressPostUrl?: string | null;
    errorMessage?: string | null;
    input?: Prisma.InputJsonValue;
  }
) {
  return prisma.blogJob.updateMany({
    where: { id: jobId, companyId },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.articleHtml !== undefined ? { articleHtml: data.articleHtml } : {}),
      ...(data.imagePrompt !== undefined ? { imagePrompt: data.imagePrompt } : {}),
      ...(data.imageTaskId !== undefined ? { imageTaskId: data.imageTaskId } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      ...(data.wordpressPostId !== undefined ? { wordpressPostId: data.wordpressPostId } : {}),
      ...(data.wordpressPostUrl !== undefined ? { wordpressPostUrl: data.wordpressPostUrl } : {}),
      ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}),
      ...(data.input !== undefined ? { input: data.input } : {}),
    },
  });
}

export async function mergeBlogJobInput(
  jobId: string,
  companyId: string,
  patch: Record<string, unknown>
) {
  const job = await getBlogJob(jobId, companyId);
  if (!job) return null;
  const next = { ...parseBlogJobInput(job.input), ...patch };
  await updateBlogJob(jobId, companyId, { input: next as Prisma.InputJsonValue });
  return next;
}

export async function claimBlogJob(job: {
  id: string;
  companyId: string;
  status: string;
  updatedAt: Date;
  input: unknown;
}) {
  const input = parseBlogJobInput(job.input);
  if (!isBlogJobLeaseExpired(input)) {
    return null;
  }

  const status = job.status as BlogJobStatus;
  const attempts = { ...(input._attempts || {}) };
  const nextAttempt = (attempts[status] || 0) + 1;
  attempts[status] = nextAttempt;

  const nextInput: BlogJobInput = {
    ...input,
    _lease: { at: new Date().toISOString() },
    _attempts: attempts,
  };

  const claimed = await prisma.blogJob.updateMany({
    where: {
      id: job.id,
      companyId: job.companyId,
      status: job.status,
      updatedAt: job.updatedAt,
    },
    data: {
      input: nextInput as Prisma.InputJsonValue,
    },
  });

  if (claimed.count === 0) return null;

  const refreshed = await getBlogJob(job.id, job.companyId);
  if (!refreshed) return null;

  return {
    job: refreshed,
    attempt: nextAttempt,
    input: parseBlogJobInput(refreshed.input),
  };
}

export async function releaseBlogJobLease(
  jobId: string,
  companyId: string,
  extraPatch: Record<string, unknown> = {}
) {
  const job = await getBlogJob(jobId, companyId);
  if (!job) return;
  const input = parseBlogJobInput(job.input);
  const { _lease: _removed, ...rest } = input;
  const next = { ...rest, ...extraPatch };
  delete (next as BlogJobInput)._lease;
  await updateBlogJob(jobId, companyId, { input: next as Prisma.InputJsonValue });
}

export async function getBlogJob(jobId: string, companyId: string) {
  return prisma.blogJob.findFirst({ where: { id: jobId, companyId } });
}

export async function listRecentBlogJobs(companyId: string, limit = 8) {
  const rows = await prisma.blogJob.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(jobToView);
}

export async function companyHasActiveBlogJob(companyId: string): Promise<boolean> {
  const count = await prisma.blogJob.count({
    where: {
      companyId,
      status: { in: BLOG_ACTIVE_STATUSES },
    },
  });
  return count > 0;
}

export async function listAdvanceableBlogJobs(limit = 5) {
  const rows = await prisma.blogJob.findMany({
    where: {
      status: { in: BLOG_ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'asc' },
    take: Math.max(limit * 4, 20),
  });

  const now = Date.now();
  return rows
    .filter((row) => isBlogJobLeaseExpired(parseBlogJobInput(row.input), now))
    .slice(0, limit);
}

export async function abandonStaleBlogJobs(olderThanMs = BLOG_JOB_ABANDON_AFTER_MS) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stale = await prisma.blogJob.findMany({
    where: {
      status: { in: BLOG_ACTIVE_STATUSES },
      createdAt: { lt: cutoff },
    },
    select: { id: true, companyId: true },
  });

  let abandoned = 0;
  for (const row of stale) {
    const result = await prisma.blogJob.updateMany({
      where: {
        id: row.id,
        companyId: row.companyId,
        status: { in: BLOG_ACTIVE_STATUSES },
      },
      data: {
        status: 'error',
        errorMessage: 'Abandoned before split-phase migration',
      },
    });
    abandoned += result.count;
  }

  return abandoned;
}

export function jobToView(row: {
  id: string;
  status: string;
  title: string | null;
  slug: string | null;
  imageUrl: string | null;
  wordpressPostId: number | null;
  wordpressPostUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BlogJobView {
  return {
    id: row.id,
    status: row.status as BlogJobStatus,
    title: row.title,
    slug: row.slug,
    imageUrl: row.imageUrl,
    wordpressPostId: row.wordpressPostId,
    wordpressPostUrl: row.wordpressPostUrl,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
