import type { LibraryAdLike } from "./view-ads";

export type AdsLibraryCardSections = {
  ukEuMetrics: boolean;
  adMetrics: boolean;
  cardMenu: boolean;
  productRevenue: boolean;
  advertiserCopy: boolean;
  ctaRow: boolean;
  productBlock: boolean;
};

export type AdsLibraryViewMode = "all" | "brands" | "dropship";

/** 0 = unlimited (∞) */
export type AdsPerBrand = 0 | 1 | 2 | 3 | 5 | 10;

export type AdsLibraryViewSettings = {
  card: AdsLibraryCardSections;
  mode: AdsLibraryViewMode;
  adsPerBrand: AdsPerBrand;
  hoverPlay: boolean;
  sound: boolean;
};

export const DEFAULT_ADS_LIBRARY_CARD_SECTIONS: AdsLibraryCardSections = {
  ukEuMetrics: true,
  adMetrics: true,
  cardMenu: true,
  productRevenue: false,
  advertiserCopy: true,
  ctaRow: true,
  productBlock: true,
};

export const DEFAULT_ADS_LIBRARY_VIEW_SETTINGS: AdsLibraryViewSettings = {
  card: DEFAULT_ADS_LIBRARY_CARD_SECTIONS,
  mode: "all",
  adsPerBrand: 0,
  hoverPlay: false,
  sound: false,
};

const STORAGE_KEY = "ads-library-view-settings-v1";

export function loadAdsLibraryViewSettings(): AdsLibraryViewSettings {
  if (typeof window === "undefined") return DEFAULT_ADS_LIBRARY_VIEW_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADS_LIBRARY_VIEW_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdsLibraryViewSettings>;
    return {
      ...DEFAULT_ADS_LIBRARY_VIEW_SETTINGS,
      ...parsed,
      card: { ...DEFAULT_ADS_LIBRARY_CARD_SECTIONS, ...parsed.card },
    };
  } catch {
    return DEFAULT_ADS_LIBRARY_VIEW_SETTINGS;
  }
}

export function saveAdsLibraryViewSettings(settings: AdsLibraryViewSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota */
  }
}

function isLikelyDropship(ad: LibraryAdLike): boolean {
  const blob = `${ad.pageName} ${ad.headline} ${ad.body} ${ad.cta} ${ad.framework} ${ad.angles.join(" ")}`.toLowerCase();
  if (/dropship|aliexpress|temu|shein|print-on-demand|pod\b/.test(blob)) return true;
  if (/shop now|buy now|free shipping|\d+% off|limited time/.test(blob) && ad.adType?.toLowerCase() !== "video") {
    return true;
  }
  return ad.angles.some((a) => /product|e-?commerce|direct.response/i.test(a));
}

export function filterAdsByViewMode<T extends LibraryAdLike>(ads: T[], mode: AdsLibraryViewMode): T[] {
  if (mode === "all") return ads;
  if (mode === "dropship") return ads.filter(isLikelyDropship);
  return ads.filter((ad) => !isLikelyDropship(ad));
}

export function limitAdsPerBrand<T extends LibraryAdLike>(ads: T[], limit: AdsPerBrand): T[] {
  if (!limit) return ads;
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const ad of ads) {
    const key = ad.pageName.trim().toLowerCase() || ad.adId;
    const n = counts.get(key) ?? 0;
    if (n >= limit) continue;
    counts.set(key, n + 1);
    out.push(ad);
  }
  return out;
}

export function applyAdsLibraryViewPipeline<T extends LibraryAdLike>(
  ads: T[],
  settings: Pick<AdsLibraryViewSettings, "mode" | "adsPerBrand">
): T[] {
  return limitAdsPerBrand(filterAdsByViewMode(ads, settings.mode), settings.adsPerBrand);
}

export const ADS_PER_BRAND_OPTIONS: { value: AdsPerBrand; label: string }[] = [
  { value: 0, label: "∞ ads/brand" },
  { value: 1, label: "1 ad/brand" },
  { value: 2, label: "2 ads/brand" },
  { value: 3, label: "3 ads/brand" },
  { value: 5, label: "5 ads/brand" },
  { value: 10, label: "10 ads/brand" },
];

export const VIEW_MODE_OPTIONS: { value: AdsLibraryViewMode; label: string }[] = [
  { value: "all", label: "Mode: All" },
  { value: "brands", label: "Mode: Brands" },
  { value: "dropship", label: "Mode: Dropship" },
];
