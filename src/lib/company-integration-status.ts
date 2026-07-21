import { prisma } from '@/lib/prisma';
import {
  type IntegrationCredentials,
  rowToCredentials,
} from '@/lib/company-integrations';
import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import {
  getModuleStatuses,
  hasAccessibleIntegrationModule,
  type ModuleStatus,
} from '@/lib/company-module-status';
import {
  applyCompanyModuleAccess,
  getCompanyModuleAccess,
} from '@/lib/company-module-access';

export async function companyHasIntegrationsConfigured(companyId: string): Promise<boolean> {
  const [row, apiSecrets, moduleAccess] = await Promise.all([
    prisma.companyIntegration.findUnique({ where: { companyId } }),
    getCompanyApiTokenSecrets(companyId),
    getCompanyModuleAccess(companyId),
  ]);
  const creds = rowToCredentials(row);
  const modules = applyCompanyModuleAccess(getModuleStatuses(creds, apiSecrets), moduleAccess);
  return hasAccessibleIntegrationModule(modules);
}

export async function getCompanyIntegrationStatus(companyId: string) {
  const [row, apiSecrets, moduleAccess] = await Promise.all([
    prisma.companyIntegration.findUnique({ where: { companyId } }),
    getCompanyApiTokenSecrets(companyId),
    getCompanyModuleAccess(companyId),
  ]);
  const creds = rowToCredentials(row);
  const modules = applyCompanyModuleAccess(getModuleStatuses(creds, apiSecrets), moduleAccess);
  return {
    configured: hasAccessibleIntegrationModule(modules),
    modules,
    credentials: creds,
  };
}

export type { ModuleStatus };
