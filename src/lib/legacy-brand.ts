/** Detect leftover Toga Health / Togahh content in ad rows, URLs, or copy. */
const LEGACY_BRAND_PATTERN =
  /toga\s*health|togahealth|togahh|toga\s*clinic|health\.togahh|m\.me\/togahh/i;

export function isLegacyTogaContent(...parts: unknown[]): boolean {
  const combined = parts
    .map((p) => {
      if (p == null) return "";
      if (typeof p === "string") return p;
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    })
    .join(" ");
  return LEGACY_BRAND_PATTERN.test(combined);
}

const TENANT_REPORT_PATTERN =
  /tenant\s*report|tenantreport|tenant\s*screening|landlord|rental\s*income|background\s*check/i;

export function isTenantReportAd(row: {
  text?: string | null;
  format?: string | null;
  "json data"?: unknown;
}): boolean {
  const combined = [row.text, row["json data"]].map((p) => {
    if (p == null) return "";
    if (typeof p === "string") return p;
    try {
      return JSON.stringify(p);
    } catch {
      return String(p);
    }
  }).join(" ");
  return TENANT_REPORT_PATTERN.test(combined);
}

export function shouldShowInApprovalQueue(row: {
  text?: string | null;
  format?: string | null;
  Approved?: string | boolean | null;
  "json data"?: unknown;
}): boolean {
  if (isLegacyTogaContent(row.text, row["json data"])) return false;

  const isApproved = row.Approved && row.Approved !== "false";
  const isVideo = (row.format || "").toLowerCase() === "video";

  // Hide approved videos that aren't clearly Tenant Report creatives
  if (isApproved && isVideo && !isTenantReportAd(row)) return false;

  return true;
}

/** Normalize media URLs for cross-table comparison (Supabase row vs Prisma variant). */
export function normalizeAdMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.trim().replace(/\/$/, "");
}

export const DEFAULT_WEBSITE_URL = "https://www.tenantreport.ai";
export const DEFAULT_BRAND_NAME = "Tenant Report AI";
