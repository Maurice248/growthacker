import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { BlogJobStatus, BlogJobView } from './types';

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
