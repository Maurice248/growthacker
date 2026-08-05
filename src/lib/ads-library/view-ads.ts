/** Minimal ad shape for view pipeline (list + card). */
export type LibraryAdLike = {
  adId: string;
  pageName: string;
  headline: string;
  body: string;
  cta: string;
  framework: string;
  angles: string[];
  adType: string;
};

export function extractVideoUrlFromRaw(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const snapshot = (raw as Record<string, unknown>).snapshot as Record<string, unknown> | undefined;
  if (!snapshot) return "";
  const videos = (snapshot.videos || []) as Record<string, unknown>[];
  for (const v of videos) {
    const url =
      v.video_sd_url ??
      v.videoSdUrl ??
      v.video_hd_url ??
      v.videoHdUrl ??
      v.video_url ??
      v.videoUrl ??
      v.url;
    if (typeof url === "string" && url.trim() && /\.mp4|video|fbcdn/i.test(url)) {
      return url.trim();
    }
  }
  return "";
}

export function domainFromAd(pageUrl: string, cta: string): string {
  const tryUrl = (u: string) => {
    try {
      return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./i, "");
    } catch {
      return "";
    }
  };
  return tryUrl(pageUrl) || tryUrl(cta) || "";
}

export function daysRunningFromDates(firstSeenAt: string, lastSeenAt: string): number | null {
  const a = new Date(firstSeenAt);
  const b = new Date(lastSeenAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const days = Math.ceil(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
  return Math.max(1, days);
}
