'use client';

import { createContext, useContext } from 'react';
import type { ModuleStatus } from '@/lib/company-module-status';

const ModuleStatusContext = createContext<ModuleStatus[]>([]);

export function ModuleStatusProvider({
  moduleStatuses,
  children,
}: {
  moduleStatuses: ModuleStatus[];
  children: React.ReactNode;
}) {
  return (
    <ModuleStatusContext.Provider value={moduleStatuses}>{children}</ModuleStatusContext.Provider>
  );
}

export function useModuleStatuses(): ModuleStatus[] {
  return useContext(ModuleStatusContext);
}

export function useModuleStatus(moduleId: string): ModuleStatus | undefined {
  return useContext(ModuleStatusContext).find((m) => m.id === moduleId);
}
