import { requireApiCompanyId } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

/** Legacy route — Create Ad now runs natively via /api/create-ad/* */
export async function POST(request: Request) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    await request.json();

    return Response.json(
      {
        success: false,
        error:
          'Ads creation has moved to native API routes. Use the Create Ad tab in the main dashboard.',
        migrated: true,
      },
      { status: 410 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
