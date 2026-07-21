import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCompanyIntegrationStatus } from '@/lib/company-integration-status';
import {
  getUnlockedModuleStatusesForAdmin,
  hasAccessibleIntegrationModule,
} from '@/lib/company-module-status';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.user.isAppAdmin && !session.user.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const modules =
    session.user.isAppAdmin && !session.user.isImpersonating
      ? getUnlockedModuleStatusesForAdmin()
      : session.user.companyId
        ? (await getCompanyIntegrationStatus(session.user.companyId)).modules
        : getUnlockedModuleStatusesForAdmin();

  return NextResponse.json({
    configured: hasAccessibleIntegrationModule(modules),
    modules: modules.map((m) => ({ id: m.id, enabled: m.enabled })),
  });
}
