import { prisma } from '@/lib/prisma';
import {
  type IntegrationCredentials,
  rowToCredentials,
} from '@/lib/company-integrations';
import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { getModuleStatuses, isAnyModuleConfigured, type ModuleStatus } from '@/lib/company-module-status';

export async function companyHasIntegrationsConfigured(companyId: string): Promise<boolean> {
  const [row, apiSecrets] = await Promise.all([
    prisma.companyIntegration.findUnique({ where: { companyId } }),
    getCompanyApiTokenSecrets(companyId),
  ]);
  const creds = rowToCredentials(row);
  return isAnyModuleConfigured(creds, apiSecrets);
}

export async function getCompanyIntegrationStatus(companyId: string) {
  const [row, apiSecrets] = await Promise.all([
    prisma.companyIntegration.findUnique({ where: { companyId } }),
    getCompanyApiTokenSecrets(companyId),
  ]);
  const creds = rowToCredentials(row);
  const modules = getModuleStatuses(creds, apiSecrets);
  return {
    configured: isAnyModuleConfigured(creds, apiSecrets),
    modules,
    credentials: creds,
  };
}

export type { ModuleStatus };
