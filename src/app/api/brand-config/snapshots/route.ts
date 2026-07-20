export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequestCompanyId } from '@/lib/auth';
import {
  createCompanyBrandSnapshot,
  listCompanyBrandSnapshots,
} from '@/lib/company-brand-config';

export async function GET() {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await listCompanyBrandSnapshots(companyId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const label = String(body.label ?? '').trim();

  if (!label) {
    return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
  }

  const fields = {
    products_services: body.products_services ?? '',
    value_proposition: body.value_proposition ?? '',
    brand_voice: body.brand_voice ?? '',
    positioning: body.positioning ?? '',
    competitors: body.competitors ?? '',
    pain_points: body.pain_points ?? '',
    icp_meta_ads: body.icp_meta_ads ?? '',
    icp_newsletter: body.icp_newsletter ?? '',
    icp_outreach: body.icp_outreach ?? '',
    icp_cold_dm: body.icp_cold_dm ?? '',
    icp_cold_call: body.icp_cold_call ?? '',
    icp_cold_sms: body.icp_cold_sms ?? '',
    icp_blog: body.icp_blog ?? '',
  };

  const result = await createCompanyBrandSnapshot(companyId, label, fields);

  if ('duplicate' in result) {
    return NextResponse.json({ duplicate: true }, { status: 409 });
  }

  return NextResponse.json({ snapshot: result.snapshot });
}
