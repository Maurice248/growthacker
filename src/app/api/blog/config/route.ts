export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { getBlogConfig, resolveBlogContext, upsertBlogConfig } from '@/lib/blog/company-context';

export async function GET() {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const [config, context] = await Promise.all([
    getBlogConfig(companyId),
    resolveBlogContext(companyId),
  ]);

  return NextResponse.json({ config, context });
}

export async function PUT(request: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  try {
    const body = await request.json();
    const config = await upsertBlogConfig(companyId, {
      titlePrompt: body.titlePrompt,
      titleUserPrompt: body.titleUserPrompt,
      articleSystemPrompt: body.articleSystemPrompt,
      articleUserPrompt: body.articleUserPrompt,
      imagePromptSystem: body.imagePromptSystem,
      runHour: body.runHour !== undefined ? Number(body.runHour) : undefined,
      runMinute: body.runMinute !== undefined ? Number(body.runMinute) : undefined,
      runTimezone: body.runTimezone,
      daysInterval: body.daysInterval !== undefined ? Number(body.daysInterval) : undefined,
      active: body.active,
      postStatus: body.postStatus,
      imageSize: body.imageSize,
      dataForSeoLocationCode:
        body.dataForSeoLocationCode !== undefined
          ? Number(body.dataForSeoLocationCode)
          : undefined,
      // Model comes from Settings → AI module routing (blog), not this form.
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[API blog/config PUT]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save blog config' },
      { status: 500 }
    );
  }
}
