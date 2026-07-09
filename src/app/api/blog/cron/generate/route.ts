export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pickRotatedCategory } from '@/lib/blog/categories';
import { upsertBlogConfig } from '@/lib/blog/company-context';
import { runFullBlogGeneration } from '@/lib/blog/generate';
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
      postUrl?: string | null;
      error?: string;
      skipped?: boolean;
      reason?: string;
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
        const category = await pickRotatedCategory(config.companyId);
        if (!category) {
          results.push({
            companyId: config.companyId,
            companyName: config.company.name,
            skipped: true,
            reason: 'No active categories',
          });
          continue;
        }

        const job = await runFullBlogGeneration(config.companyId, category.id);
        await upsertBlogConfig(config.companyId, { lastRunAt: new Date().toISOString() });

        results.push({
          companyId: config.companyId,
          companyName: config.company.name,
          categoryId: category.id,
          jobId: job.id,
          postUrl: job.wordpressPostUrl,
        });
      } catch (error) {
        results.push({
          companyId: config.companyId,
          companyName: config.company.name,
          error: error instanceof Error ? error.message : 'Blog cron failed',
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
