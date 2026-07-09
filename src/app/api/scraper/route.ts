export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserId, getRequestCompanyId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runLeadScraper } from '@/lib/cold-email/scraper';

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = await getRequestCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: 'Company context required' }, { status: 403 });
    }

    const body = await req.json();
    const { niches, location, max_results, target_sheet, list_id } = body;

    if (!niches || !location || !max_results || !target_sheet) {
      return NextResponse.json(
        { error: 'Missing required fields: niches, location, max_results, target_sheet' },
        { status: 400 }
      );
    }

    const execution = await prisma.workflowExecution.create({
      data: {
        userId,
        companyId,
        workflowType: 'SCRAPER',
        workflowName: `${location} — ${niches}`,
        status: 'RUNNING',
        inputData: JSON.stringify(body),
        startedAt: new Date(),
      },
    });

    let scraperResult;
    try {
      scraperResult = await runLeadScraper(
        companyId,
        {
          niches,
          location,
          max_results: Number(max_results),
          target_sheet,
          list_id,
        },
        execution.id
      );
    } catch (err) {
      const isConfig = err instanceof Error && err.message.includes('not configured');
      const message = err instanceof Error ? err.message : 'Scraper failed';
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          completedAt: new Date(),
          duration: Date.now() - startTime,
        },
      });
      return NextResponse.json(
        { error: message },
        { status: isConfig ? 503 : 400 }
      );
    }

    const duration = Date.now() - startTime;
    const summary = scraperResult.scraper_summary;

    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'SUCCESS',
        externalExecutionId: scraperResult.execution_id || null,
        outputData: JSON.stringify(scraperResult),
        completedAt: new Date(),
        duration,
      },
    });

    await prisma.scraperJob.create({
      data: {
        executionId: execution.id,
        niches,
        location,
        maxResults: Number(max_results),
        totalScraped: summary?.total_scraped ?? 0,
        validEmails: summary?.verified_leads ?? 0,
        invalidEmails: summary?.invalid_leads ?? 0,
        targetSheet: target_sheet,
      },
    });

    return NextResponse.json({
      success: true,
      status: scraperResult.status,
      timestamp: scraperResult.timestamp,
      executionTime: scraperResult.execution_time_seconds,
      destination: scraperResult.supabase_info.table_name,
      location,
      niches,
      supabaseInfo: {
        totalLeadsRequested: scraperResult.supabase_info.total_leads_requested,
        totalLeadsScraped: scraperResult.supabase_info.total_leads_scraped,
        saveStatus: scraperResult.supabase_info.save_status,
      },
      emailVerification: {
        verified: scraperResult.email_verification_stats.verified,
        catchAll: scraperResult.email_verification_stats.catch_all,
        invalid: scraperResult.email_verification_stats.invalid,
        unknown: scraperResult.email_verification_stats.unknown,
        bounceRiskRemoved: scraperResult.email_verification_stats.bounce_risk_removed,
      },
      summary,
    });
  } catch (error) {
    console.error('Scraper POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  try {
    const userId = await getRequestUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = await getRequestCompanyId();

    const jobs = await prisma.scraperJob.findMany({
      where: companyId
        ? { execution: { companyId } }
        : { execution: { userId } },
      include: {
        execution: {
          select: { status: true, createdAt: true, duration: true, outputData: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Scraper GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
