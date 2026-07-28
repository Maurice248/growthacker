export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRequestCompanyId } from '@/lib/auth';
import {
  deleteCompanyBrandSnapshot,
  renameCompanyBrandSnapshot,
  updateCompanyBrandSnapshot,
} from '@/lib/company-brand-config';

function snapshotFieldsFromBody(body: Record<string, string>) {
  return {
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
    icp_social: body.icp_social ?? '',
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) {
    return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
  }

  const snapshot = await renameCompanyBrandSnapshot(companyId, id, label);
  if (!snapshot) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const fields = snapshotFieldsFromBody(body);

  const snapshot = await updateCompanyBrandSnapshot(companyId, id, fields);
  if (!snapshot) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getRequestCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteCompanyBrandSnapshot(companyId, id);

  if (!deleted) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, id });
}
