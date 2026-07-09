export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { kiePollTasks } from '@/lib/create-ad/kie';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';

export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const body = await request.json();
    const taskIds = (body.taskIds || []) as string[];

    if (!taskIds.length) {
      return NextResponse.json({ error: 'taskIds array is required' }, { status: 400 });
    }

    const tokens = await getCreateAdTokens(companyId);
    if (!tokens.kie) {
      return NextResponse.json(
        { error: 'KIE API token is not configured. Add it in Integrations → API Tokens.' },
        { status: 503 }
      );
    }

    const results = await kiePollTasks(tokens.kie, taskIds);
    const allComplete = results.every(
      (r) => r.state === 'success' || r.state === 'fail' || r.state === 'failed'
    );

    return NextResponse.json({ results, allComplete });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'KIE poll failed';
    console.error('[create-ad/kie/poll]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
