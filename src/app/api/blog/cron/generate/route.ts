export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { peekRotatedCategory } from '@/lib/blog/categories';
import { upsertBlogConfig } from '@/lib/blog/company-context';
import { startBlogGeneration } from '@/lib/blog/generate';
import { companyHasActiveBlogJob } from '@/lib/blog/jobs';
import { shouldRunBlogToday } from '@/lib/blog/schedule';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configs = await prisma.blogConfig.findMany({
      where: { active: true },
      include: { company: { select: { id: true, name: true } } },
    });

    const results: Array<{
      companyId: string;
      companyName: string;
      categoryId?: string;
      jobId?: string;
      skipped?: boolean;
      reason?: string;
      error?: string;
    }> = [];

    for (const config of configs) {
      const shouldRun = shouldRunBlogToday(
        config.runHour,
        config.runMinute,
        config.runTimezone,
        config.daysInterval,
        config.lastRunAt
      );

      if (!shouldRun) {
        results.push({
          companyId: config.companyId,
          companyName: config.company.name,
          skipped: true,
          reason: 'Not scheduled for this run window',
        });
        continue;
      }

      try {
        if (await companyHasActiveBlogJob(config.companyId)) {
          results.push({
            companyId: config.companyId,
            companyName: config.company.name,
            skipped: true,
            reason: 'Active blog job already in progress',
          });
          continue;
        }

        const category = await peekRotatedCategory(config.companyId);
        if (!category) {
          results.push({
            companyId: config.companyId,
            companyName: config.company.name,
            skipped: true,
            reason: 'No active categories',
          });
          continue;
        }

        const { jobId } = await startBlogGeneration(config.companyId, {
          categoryId: category.id,
          scheduled: true,
        });

        // Honor daysInterval even if the worker later fails — enqueue marks the attempt.
        await upsertBlogConfig(config.companyId, { lastRunAt: new Date().toISOString() });

        results.push({
          companyId: config.companyId,
          companyName: config.company.name,
          categoryId: category.id,
          jobId,
        });
      } catch (error) {
        results.push({
          companyId: config.companyId,
          companyName: config.company.name,
          error: error instanceof Error ? error.message : 'Blog cron enqueue failed',
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('[API blog/cron/generate]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    );
  }
}
