import { NextRequest, NextResponse } from 'next/server';
import { getRequestCompanyId, requireCompanyAdmin } from '@/lib/auth';
import {
  getCompanyApiTokenSecrets,
  toAiGatewaySecretsView,
  upsertCompanyApiTokenSecrets,
} from '@/lib/api-token-secrets';
import { getCompanyAiRouting, saveCompanyAiRouting } from '@/lib/ai-routing-store';
import type { AiGatewayKeyField } from '@/lib/ai-module-routing';

export async function GET() {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [routing, secrets] = await Promise.all([
    getCompanyAiRouting(companyId),
    getCompanyApiTokenSecrets(companyId),
  ]);

  return NextResponse.json({
    routes: routing.routes,
    connection: routing.connection,
    gateways: toAiGatewaySecretsView(secrets),
  });
}

export async function PUT(request: NextRequest) {
  const admin = await requireCompanyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const companyId = admin.companyId!;
  const body = (await request.json()) as {
    routes?: unknown;
    connection?: unknown;
    gatewayKeys?: Partial<Record<AiGatewayKeyField, string>>;
  };

  const gatewayKeys: Partial<Record<AiGatewayKeyField, string>> = {};
  for (const key of ['openrouter', 'vercelAiGateway'] as const) {
    const value = body.gatewayKeys?.[key]?.trim();
    if (value) gatewayKeys[key] = value;
  }
  if (Object.keys(gatewayKeys).length > 0) {
    await upsertCompanyApiTokenSecrets(companyId, gatewayKeys);
  }

  const routing = await saveCompanyAiRouting(companyId, {
    routes: body.routes,
    connection: body.connection,
  });
  const secrets = await getCompanyApiTokenSecrets(companyId);

  return NextResponse.json({
    routes: routing.routes,
    connection: routing.connection,
    gateways: toAiGatewaySecretsView(secrets),
  });
}
