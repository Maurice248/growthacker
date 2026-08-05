import type { Prisma } from '@prisma/client';
import { resolveDatePresetRange, type DatePresetId } from './date-presets';

export type CopyLengthBucket = 'short' | 'medium' | 'long';
export type VideoLengthBucket = 'none' | 'short' | 'medium' | 'long';
export type DaysRunningBucket = 'under_7' | '7_30' | '30_90' | 'over_90';
export type AdStatusFilter = 'active' | 'inactive';

const COPY_SHORT_MAX = 200;
const COPY_MEDIUM_MAX = 600;

const VIDEO_SHORT_MAX = 15;
const VIDEO_MEDIUM_MAX = 60;

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

function startOfDay(dateStr: string): Date | null {
  const t = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return new Date(`${t}T00:00:00.000Z`);
}

function endOfDay(dateStr: string): Date | null {
  const t = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return new Date(`${t}T23:59:59.999Z`);
}

export function copyCharRangeWhere(min?: number, max?: number): Prisma.CompetitorAdWhereInput {
  const range: Prisma.IntFilter = {};
  if (min != null && Number.isFinite(min)) range.gte = min;
  if (max != null && Number.isFinite(max)) range.lte = max;
  if (range.gte == null && range.lte == null) return {};
  return { copyCharCount: range };
}

export function videoDurationRangeWhere(min?: number, max?: number): Prisma.CompetitorAdWhereInput {
  const range: Prisma.IntNullableFilter = {};
  if (min != null && Number.isFinite(min)) range.gte = min;
  if (max != null && Number.isFinite(max)) range.lte = max;
  if (range.gte == null && range.lte == null) return {};
  return { videoDurationSec: range };
}

export function countriesIncludeWhere(codes: string[]): Prisma.CompetitorAdWhereInput {
  const list = codes.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (!list.length) return {};
  if (list.length === 1) return { reachCountries: { has: list[0] } };
  return { OR: list.map((code) => ({ reachCountries: { has: code } })) };
}

export function countriesExcludeWhere(codes: string[]): Prisma.CompetitorAdWhereInput {
  const list = codes.map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (!list.length) return {};
  return {
    AND: list.map((code) => ({
      NOT: { reachCountries: { has: code } },
    })),
  };
}

export function languagesIncludeWhere(codes: string[]): Prisma.CompetitorAdWhereInput {
  const list = codes.map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return {};
  if (list.length === 1) return { languageCode: list[0] };
  return { OR: list.map((code) => ({ languageCode: code })) };
}

export function languagesExcludeWhere(codes: string[]): Prisma.CompetitorAdWhereInput {
  const list = codes.map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return {};
  return {
    AND: list.map((code) => ({
      NOT: { languageCode: code },
    })),
  };
}

export function statusCheckboxesWhere(active: boolean, inactive: boolean): Prisma.CompetitorAdWhereInput {
  if (active && inactive) return {};
  if (active) return { adActive: true };
  if (inactive) return { adActive: false };
  return {};
}

export function mediaTypesWhere(types: string[]): Prisma.CompetitorAdWhereInput {
  const list = types.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return {};
  if (list.length === 1) return { adType: list[0] };
  return { OR: list.map((adType) => ({ adType })) };
}

export function copyLengthWhere(bucket: CopyLengthBucket): Prisma.CompetitorAdWhereInput {
  switch (bucket) {
    case 'short':
      return { copyCharCount: { lte: COPY_SHORT_MAX } };
    case 'medium':
      return { copyCharCount: { gt: COPY_SHORT_MAX, lte: COPY_MEDIUM_MAX } };
    case 'long':
      return { copyCharCount: { gt: COPY_MEDIUM_MAX } };
    default:
      return {};
  }
}

export function videoLengthWhere(bucket: VideoLengthBucket): Prisma.CompetitorAdWhereInput {
  switch (bucket) {
    case 'none':
      return { OR: [{ hasVideo: false }, { videoDurationSec: null }] };
    case 'short':
      return { videoDurationSec: { gt: 0, lte: VIDEO_SHORT_MAX } };
    case 'medium':
      return { videoDurationSec: { gt: VIDEO_SHORT_MAX, lte: VIDEO_MEDIUM_MAX } };
    case 'long':
      return { videoDurationSec: { gt: VIDEO_MEDIUM_MAX } };
    default:
      return {};
  }
}

/** Days running ≈ days since `startDate`. Range [minDays, maxDays] inclusive. */
export function daysRunningRangeWhere(minDays?: number, maxDays?: number): Prisma.CompetitorAdWhereInput {
  const hasMin = minDays != null && Number.isFinite(minDays);
  const hasMax = maxDays != null && Number.isFinite(maxDays);
  if (!hasMin && !hasMax) return {};

  const parts: Prisma.CompetitorAdWhereInput[] = [{ startDate: { not: 'unknown' } }];
  if (hasMax) {
    parts.push({ startDate: { gte: isoDateDaysAgo(maxDays!) } });
  }
  if (hasMin) {
    parts.push({ startDate: { lte: isoDateDaysAgo(minDays!) } });
  }
  return { AND: parts };
}

export function daysRunningWhere(bucket: DaysRunningBucket): Prisma.CompetitorAdWhereInput {
  const today = isoDateDaysAgo(0);
  switch (bucket) {
    case 'under_7': {
      const from = isoDateDaysAgo(7);
      return {
        startDate: { gte: from, lte: today, not: 'unknown' },
      };
    }
    case '7_30': {
      const from = isoDateDaysAgo(30);
      const to = isoDateDaysAgo(7);
      return { startDate: { gte: from, lt: to, not: 'unknown' } };
    }
    case '30_90': {
      const from = isoDateDaysAgo(90);
      const to = isoDateDaysAgo(30);
      return { startDate: { gte: from, lt: to, not: 'unknown' } };
    }
    case 'over_90': {
      const before = isoDateDaysAgo(90);
      return { startDate: { lt: before, not: 'unknown' } };
    }
    default:
      return {};
  }
}

export function adCreationDateWhere(from: string, to: string): Prisma.CompetitorAdWhereInput {
  const parts: Prisma.CompetitorAdWhereInput[] = [{ startDate: { not: 'unknown' } }];
  if (from) parts.push({ startDate: { gte: from } });
  if (to) parts.push({ startDate: { lte: to } });
  return { AND: parts };
}

export function lastSeenDateWhere(from: string, to: string): Prisma.CompetitorAdWhereInput {
  const range: Prisma.DateTimeFilter = {};
  const fromDt = from ? startOfDay(from) : null;
  const toDt = to ? endOfDay(to) : null;
  if (fromDt) range.gte = fromDt;
  if (toDt) range.lte = toDt;
  if (!fromDt && !toDt) return {};
  return { lastSeenAt: range };
}

export function adStatusWhere(status: AdStatusFilter): Prisma.CompetitorAdWhereInput {
  return { adActive: status === 'active' };
}

export function countryWhere(code: string): Prisma.CompetitorAdWhereInput {
  const c = code.trim().toUpperCase();
  if (!c) return {};
  return { reachCountries: { has: c } };
}

export function languageWhere(code: string): Prisma.CompetitorAdWhereInput {
  const lang = code.trim().toLowerCase();
  if (!lang) return {};
  return { languageCode: lang };
}

type DatePreset = DatePresetId;

export function createdPresetWhere(preset: DatePreset): Prisma.CompetitorAdWhereInput {
  const { from, to } = resolveDatePresetRange(preset);
  return adCreationDateWhere(from, to);
}

export function lastSeenPresetWhere(preset: DatePreset): Prisma.CompetitorAdWhereInput {
  const { from, to } = resolveDatePresetRange(preset);
  return lastSeenDateWhere(from, to);
}
