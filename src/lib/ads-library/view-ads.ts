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

/** Decode + humanize Meta CTA enums / encoded labels (e.g. use%20app, USE_APP → Use App). */
export function formatCtaLabel(cta: string): string {
  if (!cta) return "";
  let text = cta.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    /* keep original when not valid URI encoding */
  }
  text = text.replace(/[_+]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  // Already readable sentence / title — keep casing aside from cleanup
  if (/[a-z]/.test(text) && text.includes(" ") && text !== text.toUpperCase()) {
    return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return text
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function looksLikeHostname(value: string): boolean {
  const v = value.trim();
  if (!v || /\s/.test(v) || v.includes("%")) return false;
  // Require a dot so CTA enums like USE_APP / learn_more are not treated as hosts
  if (!v.includes(".")) return false;
  try {
    const host = new URL(v.startsWith("http") ? v : `https://${v}`).hostname.replace(/^www\./i, "");
    return Boolean(host && host.includes("."));
  } catch {
    return false;
  }
}

export function domainFromAd(pageUrl: string, cta: string): string {
  const tryUrl = (u: string) => {
    if (!u || !looksLikeHostname(u)) return "";
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
