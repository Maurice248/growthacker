import { prisma } from '@/lib/prisma';
import type { PlatformDescriptions, SocialScene } from './types';

export type SocialStudioBackgroundKind = 'image' | 'video' | 'video_render';
export type SocialBackgroundRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type SocialStudioJobRecord = {
  id: string;
  companyId: string;
  kind: string;
  status: string;
  input: unknown;
  story: string | null;
  scenes: SocialScene[] | null;
  assetUrl: string | null;
  descriptions: PlatformDescriptions | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseScenes(raw: unknown): SocialScene[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  return raw as SocialScene[];
}

function parseDescriptions(raw: unknown): PlatformDescriptions | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, string>;
  return {
    facebook: d.facebook || '',
    instagram: d.instagram || '',
    linkedin: d.linkedin || '',
    tiktok: d.tiktok || '',
    twitter: d.twitter || '',
    youtube: d.youtube,
  };
}

function toRecord(row: {
  id: string;
  companyId: string;
  kind: string;
  status: string;
  input: unknown;
  story: string | null;
  scenes: unknown;
  assetUrl: string | null;
  descriptions: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SocialStudioJobRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind,
    status: row.status,
    input: row.input,
    story: row.story,
    scenes: parseScenes(row.scenes),
    assetUrl: row.assetUrl,
    descriptions: parseDescriptions(row.descriptions),
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createSocialJob(
  companyId: string,
  kind: 'image' | 'video',
  input: unknown,
  status = 'pending'
): Promise<SocialStudioJobRecord> {
  const row = await prisma.socialStudioJob.create({
    data: {
      companyId,
      kind,
      status,
      input: input as object,
    },
  });
  return toRecord(row);
}

export async function updateSocialJob(
  jobId: string,
  companyId: string,
  patch: Partial<{
    status: string;
    story: string;
    scenes: SocialScene[];
    assetUrl: string;
    descriptions: PlatformDescriptions;
    error: string | null;
    input: unknown;
  }>
): Promise<SocialStudioJobRecord> {
  const existing = await prisma.socialStudioJob.findFirst({ where: { id: jobId, companyId } });
  if (!existing) throw new Error('Job not found');

  const row = await prisma.socialStudioJob.update({
    where: { id: jobId },
    data: {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.story !== undefined ? { story: patch.story } : {}),
      ...(patch.scenes !== undefined ? { scenes: patch.scenes as object } : {}),
      ...(patch.assetUrl !== undefined ? { assetUrl: patch.assetUrl } : {}),
      ...(patch.descriptions !== undefined ? { descriptions: patch.descriptions as object } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.input !== undefined ? { input: patch.input as object } : {}),
    },
  });
  return toRecord(row);
}

export async function getSocialJob(jobId: string, companyId: string): Promise<SocialStudioJobRecord | null> {
  const row = await prisma.socialStudioJob.findFirst({ where: { id: jobId, companyId } });
  return row ? toRecord(row) : null;
}

export async function getLatestSocialJob(
  companyId: string,
  kind?: 'image' | 'video'
): Promise<SocialStudioJobRecord | null> {
  const row = await prisma.socialStudioJob.findFirst({
    where: { companyId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toRecord(row) : null;
}

export async function getLatestPipelineStatus(companyId: string): Promise<string> {
  const row = await prisma.socialStudioJob.findFirst({
    where: { companyId },
    orderBy: { updatedAt: 'desc' },
    select: { status: true },
  });
  return row?.status || 'Waiting for data...';
}

export function mergeSocialJobInput(
  existing: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {};
  return { ...base, ...patch };
}

export function getBackgroundRunStatus(job: SocialStudioJobRecord): SocialBackgroundRunStatus | null {
  const input = job.input as Record<string, unknown> | null;
  if (!input?.backgroundJob) return null;
  const rs = input.runStatus;
  if (rs === 'pending' || rs === 'running' || rs === 'completed' || rs === 'failed') {
    return rs;
  }
  return null;
}

export async function getActiveSocialBackgroundJob(
  companyId: string
): Promise<SocialStudioJobRecord | null> {
  const rows = await prisma.socialStudioJob.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  for (const row of rows) {
    const rec = toRecord(row);
    const rs = getBackgroundRunStatus(rec);
    if (rs === 'pending' || rs === 'running') return rec;
  }
  return null;
}

export async function createSocialBackgroundJob(
  companyId: string,
  kind: SocialStudioBackgroundKind,
  payload: Record<string, unknown>
): Promise<SocialStudioJobRecord> {
  const row = await prisma.socialStudioJob.create({
    data: {
      companyId,
      kind: kind === 'video_render' ? 'video' : kind,
      status: 'pending',
      input: mergeSocialJobInput(null, {
        ...payload,
        backgroundJob: true,
        runStatus: 'pending',
        backgroundKind: kind,
      }) as object,
    },
  });
  return toRecord(row);
}
