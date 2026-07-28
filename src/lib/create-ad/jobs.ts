import { prisma } from '@/lib/prisma';

export type CreateAdJobKind = 'prompts' | 'video' | 'image';

export type CreateAdJobRecord = {
  id: string;
  companyId: string;
  kind: CreateAdJobKind;
  status: string;
  input: unknown;
  result: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toRecord(row: {
  id: string;
  companyId: string;
  kind: string;
  status: string;
  input: unknown;
  result: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CreateAdJobRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind as CreateAdJobKind,
    status: row.status,
    input: row.input,
    result: row.result,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createCreateAdJob(
  companyId: string,
  kind: CreateAdJobKind,
  input: unknown
): Promise<CreateAdJobRecord> {
  const row = await prisma.createAdJob.create({
    data: {
      companyId,
      kind,
      status: 'pending',
      input: input as object,
    },
  });
  return toRecord(row);
}

export async function updateCreateAdJob(
  jobId: string,
  companyId: string,
  patch: Partial<{ status: string; result: unknown; error: string | null }>
): Promise<CreateAdJobRecord> {
  const existing = await prisma.createAdJob.findFirst({ where: { id: jobId, companyId } });
  if (!existing) throw new Error('Job not found');

  const row = await prisma.createAdJob.update({
    where: { id: jobId },
    data: {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.result !== undefined ? { result: patch.result as object } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
    },
  });
  return toRecord(row);
}

export async function getCreateAdJob(jobId: string, companyId: string): Promise<CreateAdJobRecord | null> {
  const row = await prisma.createAdJob.findFirst({ where: { id: jobId, companyId } });
  return row ? toRecord(row) : null;
}

export async function getActiveCreateAdJob(companyId: string): Promise<CreateAdJobRecord | null> {
  const row = await prisma.createAdJob.findFirst({
    where: {
      companyId,
      status: { in: ['pending', 'running'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toRecord(row) : null;
}
