'use client';

import { useSession } from 'next-auth/react';

export async function startImpersonating(
  update: ReturnType<typeof useSession>['update'],
  companyId: string
): Promise<boolean> {
  const res = await fetch('/api/admin/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId }),
  });
  if (!res.ok) return false;
  await update({ impersonate: companyId });
  return true;
}

export async function stopImpersonating(
  update: ReturnType<typeof useSession>['update']
): Promise<void> {
  await fetch('/api/admin/impersonate', { method: 'DELETE' });
  await update({ impersonate: null });
}
