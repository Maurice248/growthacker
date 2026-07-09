import { prisma } from '@/lib/prisma';
import type { OutreachConfigData } from './types';

function configFromRow(row: {
  instantlyCampaignId: string;
  senderName: string;
  defaultCtaLink: string;
  cleanupIntervalDays: number;
  cleanupBatchSize: number;
  dailySendLimit: number;
  active: boolean;
}): OutreachConfigData {
  return {
    instantlyCampaignId: row.instantlyCampaignId,
    senderName: row.senderName,
    defaultCtaLink: row.defaultCtaLink,
    cleanupIntervalDays: row.cleanupIntervalDays,
    cleanupBatchSize: row.cleanupBatchSize,
    dailySendLimit: row.dailySendLimit,
    active: row.active,
  };
}

export async function getOutreachConfig(companyId: string): Promise<OutreachConfigData | null> {
  const row = await prisma.outreachConfig.findUnique({ where: { companyId } });
  if (!row) return null;
  return configFromRow(row);
}

export async function upsertOutreachConfig(
  companyId: string,
  input: Partial<OutreachConfigData>
): Promise<OutreachConfigData> {
  const row = await prisma.outreachConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      instantlyCampaignId: input.instantlyCampaignId ?? '',
      senderName: input.senderName ?? '',
      defaultCtaLink: input.defaultCtaLink ?? '',
      cleanupIntervalDays: input.cleanupIntervalDays ?? 10,
      cleanupBatchSize: input.cleanupBatchSize ?? 100,
      dailySendLimit: input.dailySendLimit ?? 60,
      active: input.active ?? true,
    },
    update: {
      ...(input.instantlyCampaignId !== undefined ? { instantlyCampaignId: input.instantlyCampaignId } : {}),
      ...(input.senderName !== undefined ? { senderName: input.senderName } : {}),
      ...(input.defaultCtaLink !== undefined ? { defaultCtaLink: input.defaultCtaLink } : {}),
      ...(input.cleanupIntervalDays !== undefined ? { cleanupIntervalDays: input.cleanupIntervalDays } : {}),
      ...(input.cleanupBatchSize !== undefined ? { cleanupBatchSize: input.cleanupBatchSize } : {}),
      ...(input.dailySendLimit !== undefined ? { dailySendLimit: input.dailySendLimit } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });

  return configFromRow(row);
}

export async function listLeadLists(companyId: string) {
  return prisma.outreachLeadList.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { leads: true } },
    },
  });
}

export async function getLeadList(companyId: string, listId: string) {
  return prisma.outreachLeadList.findFirst({
    where: { id: listId, companyId },
    include: {
      _count: { select: { leads: true } },
    },
  });
}

export async function createLeadList(
  companyId: string,
  name: string,
  description = ''
) {
  return prisma.outreachLeadList.create({
    data: { companyId, name: name.trim(), description: description.trim() },
  });
}

export async function updateLeadList(
  companyId: string,
  listId: string,
  input: { name?: string; description?: string }
) {
  const existing = await prisma.outreachLeadList.findFirst({
    where: { id: listId, companyId },
  });
  if (!existing) return null;

  return prisma.outreachLeadList.update({
    where: { id: listId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    },
  });
}

export async function deleteLeadList(companyId: string, listId: string) {
  const existing = await prisma.outreachLeadList.findFirst({
    where: { id: listId, companyId },
  });
  if (!existing) return false;

  await prisma.outreachLeadList.delete({ where: { id: listId } });
  return true;
}

export async function resolveLeadListId(
  companyId: string,
  listIdOrName: string
): Promise<{ id: string; name: string } | null> {
  const trimmed = listIdOrName.trim();
  if (!trimmed) return null;

  const byId = await prisma.outreachLeadList.findFirst({
    where: { companyId, id: trimmed },
    select: { id: true, name: true },
  });
  if (byId) return byId;

  const byName = await prisma.outreachLeadList.findFirst({
    where: { companyId, name: trimmed },
    select: { id: true, name: true },
  });
  return byName;
}

export async function listLeads(
  companyId: string,
  options: { listId?: string; sentStatus?: string; limit?: number } = {}
) {
  const { listId, sentStatus, limit = 100 } = options;
  return prisma.outreachLead.findMany({
    where: {
      companyId,
      ...(listId ? { listId } : {}),
      ...(sentStatus ? { sentStatus } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { list: { select: { name: true } } },
  });
}

export async function countLeadsByStatus(companyId: string, listId?: string) {
  const where = {
    companyId,
    ...(listId ? { listId } : {}),
  };

  const [total, verified, sent, available] = await Promise.all([
    prisma.outreachLead.count({ where }),
    prisma.outreachLead.count({ where: { ...where, emailStatus: 'verified' } }),
    prisma.outreachLead.count({ where: { ...where, sentStatus: 'sent' } }),
    prisma.outreachLead.count({
      where: { ...where, emailStatus: 'verified', sentStatus: 'not_sent' },
    }),
  ]);

  return { total, verified, sent, available };
}
