export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { startBlogGeneration } from '@/lib/blog/generate';

export async function POST(request: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  try {
    const body = await request.json();
    const categoryId = String(body.categoryId || '').trim();

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
    }

    const { jobId } = await startBlogGeneration(companyId, { categoryId });

    return NextResponse.json({
      success: true,
      configured: true,
      jobId,
    });
  } catch (error) {
    console.error('[API blog/generate POST]', error);
    const message = error instanceof Error ? error.message : 'Failed to start blog generation';
    const status = message.includes('not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
