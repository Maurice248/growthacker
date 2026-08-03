import { NextRequest, NextResponse } from 'next/server';
import { getRequestCompanyId, requireCompanyAdmin } from '@/lib/auth';
import {
  getCompanyApiTokenSecrets,
  getDataForSeoCredentialView,
  toApiTokenSecretsView,
  toApifyIntegrationView,
  upsertCompanyApiTokenSecrets,
  type ApiTokenSecretKey,
} from '@/lib/api-token-secrets';

export async function GET() {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secrets = await getCompanyApiTokenSecrets(companyId);
  return NextResponse.json({
    tokens: toApiTokenSecretsView(secrets),
    apify: toApifyIntegrationView(secrets),
    dataforseo: getDataForSeoCredentialView(secrets),
  });
}

export async function PUT(request: NextRequest) {
  const admin = await requireCompanyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const companyId = admin.companyId!;
  const body = (await request.json()) as Partial<Record<ApiTokenSecretKey, string>> & {
    dataforseo?: string;
    dataforseoLogin?: string;
    dataforseoPassword?: string;
    competitorApifyActor?: string;
  };
  const saved = await upsertCompanyApiTokenSecrets(companyId, body);
  const secrets = await getCompanyApiTokenSecrets(companyId);
  return NextResponse.json({
    tokens: saved.tokens,
    apify: saved.apify,
    dataforseo: getDataForSeoCredentialView(secrets),
  });
}
