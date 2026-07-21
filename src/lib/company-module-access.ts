import { prisma } from '@/lib/prisma';
import type { ModuleId, ModuleStatus } from '@/lib/company-module-status';

export type CompanyModuleAccess = {
  id: string;
  companyId: string;
  metaEnabled: boolean;
  socialEnabled: boolean;
  newsletterEnabled: boolean;
  outreachEnabled: boolean;
  blogEnabled: boolean;
  coldDmEnabled: boolean;
  coldCallEnabled: boolean;
  coldSmsEnabled: boolean;
  maintenanceMessage: string;
  updatedAt: Date;
};

export const DEFAULT_MAINTENANCE_MESSAGE =
  'This module is under maintenance. Please check back later.';

const MODULE_ENABLED_FIELD: Record<ModuleId, keyof CompanyModuleAccess> = {
  meta: 'metaEnabled',
  social: 'socialEnabled',
  newsletter: 'newsletterEnabled',
  outreach: 'outreachEnabled',
  blog: 'blogEnabled',
  coldDm: 'coldDmEnabled',
  coldCall: 'coldCallEnabled',
  coldSms: 'coldSmsEnabled',
};

export async function ensureCompanyModuleAccess(companyId: string): Promise<CompanyModuleAccess> {
  return prisma.companyModuleAccess.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
}

export async function getCompanyModuleAccess(companyId: string): Promise<CompanyModuleAccess> {
  return ensureCompanyModuleAccess(companyId);
}

export function isModuleEnabledForCompany(
  access: CompanyModuleAccess,
  moduleId: ModuleId
): boolean {
  return Boolean(access[MODULE_ENABLED_FIELD[moduleId]]);
}

export function applyCompanyModuleAccess(
  modules: ModuleStatus[],
  access: CompanyModuleAccess
): ModuleStatus[] {
  return modules.map((m) => {
    const enabled = isModuleEnabledForCompany(access, m.id);
    return {
      ...m,
      enabled,
      accessible: enabled && m.configured,
      maintenanceMessage: access.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
    };
  });
}

export function getAdminPreviewModuleStatuses(baseModules: ModuleStatus[]): ModuleStatus[] {
  return baseModules.map((m) => ({
    ...m,
    configured: true,
    missingKeys: [],
    enabled: true,
    accessible: true,
    maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
  }));
}
