export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  getSocialStudioPostingConfig,
  resolveSocialContext,
  upsertSocialStudioConfig,
} from '@/lib/social-studio/config';
import type { SocialPlatform } from '@/lib/social-studio/types';

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const [configResult, contextResult] = await Promise.allSettled([
      getSocialStudioPostingConfig(companyId),
      resolveSocialContext(companyId),
    ]);

    const config = configResult.status === 'fulfilled' ? configResult.value : null;
    const context = contextResult.status === 'fulfilled' ? contextResult.value : null;

    if (!config && !context) {
      const reason =
        configResult.status === 'rejected'
          ? configResult.reason
          : contextResult.status === 'rejected'
            ? contextResult.reason
            : null;
      const message = reason instanceof Error ? reason.message : 'Failed to load config';
      console.error('[social-studio/config]', reason);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ config, context });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load config';
    console.error('[social-studio/config]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const config = await upsertSocialStudioConfig(companyId, {
      defaultImageRatio: body.defaultImageRatio,
      uploadPostUser: body.uploadPostUser,
      facebookPageId: body.facebookPageId,
      linkedinOrgUrn: body.linkedinOrgUrn,
      tiktokHandle: body.tiktokHandle,
      enabledPlatforms: body.enabledPlatforms as SocialPlatform[] | undefined,
    });

    return NextResponse.json({ config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
