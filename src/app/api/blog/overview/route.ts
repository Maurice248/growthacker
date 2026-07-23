export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { listBlogCategories } from '@/lib/blog/categories';
import { getBlogConfig, resolveBlogContext } from '@/lib/blog/company-context';
import { listRecentBlogJobs } from '@/lib/blog/jobs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const [config, context, categories, recentJobs, doneCount, errorCount, inProgressCount] =
    await Promise.all([
      getBlogConfig(companyId),
      resolveBlogContext(companyId),
      listBlogCategories(companyId),
      listRecentBlogJobs(companyId, 8),
      prisma.blogJob.count({ where: { companyId, status: 'done' } }),
      prisma.blogJob.count({ where: { companyId, status: 'error' } }),
      prisma.blogJob.count({
        where: { companyId, status: { notIn: ['done', 'error'] } },
      }),
    ]);

  const activeCategories = categories.filter((c) => c.active).length;

  return NextResponse.json({
    config,
    context,
    stats: {
      activeCategories,
      totalCategories: categories.length,
      jobsCompleted: doneCount,
      jobsFailed: errorCount,
      jobsInProgress: inProgressCount,
    },
    recentJobs,
  });
}
