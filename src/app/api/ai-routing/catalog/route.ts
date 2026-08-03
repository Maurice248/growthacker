import { NextRequest, NextResponse } from 'next/server';
import { getRequestCompanyId } from '@/lib/auth';
import { getAiGatewayCatalogs } from '@/lib/ai-gateway-catalog';
import {
  OPENROUTER_DEFAULT_BASE_URL,
  VERCEL_AI_GATEWAY_DEFAULT_BASE_URL,
} from '@/lib/ai-module-routing';

export async function GET(request: NextRequest) {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const openrouterBaseUrl =
    searchParams.get('openrouterBaseUrl')?.trim() || OPENROUTER_DEFAULT_BASE_URL;
  const vercelGatewayBaseUrl =
    searchParams.get('vercelGatewayBaseUrl')?.trim() || VERCEL_AI_GATEWAY_DEFAULT_BASE_URL;

  try {
    const catalogs = await getAiGatewayCatalogs({
      openrouterBaseUrl,
      vercelGatewayBaseUrl,
    });
    return NextResponse.json(catalogs);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load gateway catalogs';
    console.error('[ai-routing/catalog]', err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
