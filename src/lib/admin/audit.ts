import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AdminAuditAction =
  | 'user.role_change'
  | 'user.delete'
  | 'company.update'
  | 'company.delete'
  | 'impersonate.start'
  | 'impersonate.end';

export async function logAdminAction(params: {
  actorUserId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('[admin/audit]', err);
  }
}
