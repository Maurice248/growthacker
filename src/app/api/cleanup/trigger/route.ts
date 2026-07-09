export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserId, getRequestCompanyId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runCleanup } from '@/lib/cold-email/cleanup';

export async function POST(req: NextRequest) {
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
    const forceCleanup = body.force_cleanup === true;

    const execution = await prisma.workflowExecution.create({
      data: {
        userId,
        companyId,
        workflowType: 'CLEANUP',
        workflowName: forceCleanup ? 'Manual Cleanup' : 'Scheduled Cleanup',
        status: 'RUNNING',
        inputData: JSON.stringify({ force_cleanup: forceCleanup }),
        startedAt: new Date(),
      },
    });

    const startTime = Date.now();
    let cleanupResult;
    try {
      cleanupResult = await runCleanup(companyId, { force: forceCleanup });
    } catch (err) {
      const isConfig = err instanceof Error && err.message.includes('not configured');
      const message = err instanceof Error ? err.message : 'Cleanup failed';
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          completedAt: new Date(),
          duration: Date.now() - startTime,
        },
      });
      return NextResponse.json({ error: message }, { status: isConfig ? 503 : 500 });
    }

    const result = {
      status: cleanupResult.status === 'error' ? 'error' : 'success',
      execution_id: execution.id,
      workflow_type: 'cleanup',
      results: {
        total_contacts: cleanupResult.emails_processed,
        deleted_count: cleanupResult.deleted_from_instantly,
      },
      message: cleanupResult.message,
      timestamp: cleanupResult.cleanup_date,
    };

    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: cleanupResult.instantly_success ? 'SUCCESS' : 'FAILED',
        outputData: JSON.stringify(result),
        completedAt: new Date(),
        duration: Date.now() - startTime,
      },
    });

    await prisma.cleanupLog.create({
      data: {
        executionId: execution.id,
        totalContacts: cleanupResult.emails_processed,
        deletedCount: cleanupResult.deleted_from_instantly,
        triggerType: forceCleanup ? 'manual' : 'scheduled',
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Cleanup trigger POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
