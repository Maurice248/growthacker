/** Extract filterable metadata from Apify / Meta Ads Library raw payloads. */

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? [t.toUpperCase()] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim().toUpperCase() : ''))
    .filter(Boolean);
}

function parseActive(raw: Record<string, unknown>): boolean | null {
  const v = raw.is_active ?? raw.isActive ?? raw.active_status;
  if (v === true || v === 'active' || v === 'ACTIVE') return true;
  if (v === false || v === 'inactive' || v === 'INACTIVE') return false;
  return null;
}

function parseLanguage(raw: Record<string, unknown>): string {
  const langs = raw.languages ?? raw.language ?? raw.ad_languages;
  if (Array.isArray(langs) && langs.length > 0) {
    const first = langs[0];
    if (typeof first === 'string') return first.trim().toLowerCase();
  }
  if (typeof langs === 'string') return langs.trim().toLowerCase();
  return '';
}

function parseCountries(raw: Record<string, unknown>): string[] {
  const from =
    raw.targeted_or_reached_countries ??
    raw.targetedOrReachedCountries ??
    raw.reached_countries ??
    raw.countries ??
    raw.country;
  return asStringArray(from);
}

function parseVideoDurationSec(raw: Record<string, unknown>): number | null {
  const snapshot = (raw.snapshot || {}) as Record<string, unknown>;
  const videos = (snapshot.videos || []) as Record<string, unknown>[];
  let max: number | null = null;
  for (const vid of videos) {
    const d =
      vid.video_duration_seconds ??
      vid.videoDurationSeconds ??
      vid.duration_seconds ??
      vid.duration ??
      vid.length;
    if (d == null || d === '') continue;
    const n = typeof d === 'number' ? d : parseFloat(String(d));
    if (!Number.isFinite(n) || n <= 0) continue;
    max = max == null ? n : Math.max(max, n);
  }
  return max;
}

export type ExtractedAdMeta = {
  reachCountries: string[];
  adActive: boolean | null;
  languageCode: string;
  videoDurationSec: number | null;
  copyCharCount: number;
};

export function extractAdMetaFromRaw(raw: unknown, copyParts: string[]): ExtractedAdMeta {
  const copyCharCount = copyParts.join(' ').trim().length;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      reachCountries: [],
      adActive: null,
      languageCode: '',
      videoDurationSec: null,
      copyCharCount,
    };
  }
  const obj = raw as Record<string, unknown>;
  return {
    reachCountries: parseCountries(obj),
    adActive: parseActive(obj),
    languageCode: parseLanguage(obj),
    videoDurationSec: parseVideoDurationSec(obj),
    copyCharCount,
  };
}
