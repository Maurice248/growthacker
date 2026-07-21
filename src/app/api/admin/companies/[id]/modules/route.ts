export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAppAdmin } from '@/lib/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { MODULE_IDS, MODULE_LABELS, type ModuleId } from '@/lib/company-module-status';
import {
  ensureCompanyModuleAccess,
  type CompanyModuleAccess,
} from '@/lib/company-module-access';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

function serializeAccess(access: CompanyModuleAccess) {
  return {
    maintenanceMessage: access.maintenanceMessage,
    updatedAt: access.updatedAt.toISOString(),
    modules: MODULE_IDS.map((id) => ({
      id,
      label: MODULE_LABELS[id],
      enabled: access[`${id}Enabled` as keyof CompanyModuleAccess] as boolean,
    })),
  };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: companyId } = await context.params;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  }

  const access = await ensureCompanyModuleAccess(companyId);
  return NextResponse.json(serializeAccess(access));
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const admin = await requireAppAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: companyId } = await context.params;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  }

  try {
    await ensureCompanyModuleAccess(companyId);

    const body = await req.json();
    const data: Record<string, boolean | string> = {};

    if (typeof body.maintenanceMessage === 'string') {
      data.maintenanceMessage = body.maintenanceMessage.trim().slice(0, 500);
    }

    for (const id of MODULE_IDS) {
      const key = `${id}Enabled`;
      if (typeof body[key] === 'boolean') {
        data[key] = body[key];
      }
    }

    if (body.modules && typeof body.modules === 'object' && !Array.isArray(body.modules)) {
      for (const id of MODULE_IDS) {
        if (typeof body.modules[id] === 'boolean') {
          data[`${id}Enabled`] = body.modules[id];
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const updated = await prisma.companyModuleAccess.update({
      where: { companyId },
      data,
    });

    await logAdminAction({
      actorUserId: admin.id,
      action: 'company.modules.update',
      targetType: 'company',
      targetId: companyId,
      metadata: data,
    });

    return NextResponse.json(serializeAccess(updated));
  } catch (err) {
    console.error('[admin/companies/modules PATCH]', err);
    return NextResponse.json({ error: 'Failed to update module access.' }, { status: 500 });
  }
}
