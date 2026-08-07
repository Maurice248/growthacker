export const DEFAULT_AD_LIBRARY_MAX_ADS = 10;
export const AD_LIBRARY_MAX_ADS_CAP = 500;
export const AD_LIBRARY_MAX_ADS_PRESETS = [30, 50, 100, 250, 500] as const;

export function resolveAdLibraryMaxAds(raw: string | null | undefined): number {
  const n = parseInt(String(raw ?? DEFAULT_AD_LIBRARY_MAX_ADS).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_AD_LIBRARY_MAX_ADS;
  return Math.min(AD_LIBRARY_MAX_ADS_CAP, n);
}
