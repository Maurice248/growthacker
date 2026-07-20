import { createHash } from "crypto";

export type BrandProfileData = {
  productsAndServices: string;
  valueProposition: string;
  brandVoice: string;
  positioning: string;
  competitors: string;
  painPoints: string;
  icpMetaAds: string;
  icpNewsletter: string;
  icpOutreach: string;
  icpColdDm: string;
  icpColdCall: string;
  icpColdSms: string;
  icpBlog: string;
  destinationUrl: string;
};

export type BrandConfigDbRow = {
  products_services?: string;
  value_proposition?: string;
  brand_voice?: string;
  positioning?: string;
  competitors?: string;
  pain_points?: string;
  icp_meta_ads?: string;
  icp_newsletter?: string;
  icp_outreach?: string;
  icp_cold_dm?: string;
  icp_cold_call?: string;
  icp_cold_sms?: string;
  icp_blog?: string;
  destination_url?: string;
};

export type BrandSnapshot = {
  id: string;
  brand_config_id: string;
  products_services: string;
  value_proposition: string;
  brand_voice: string;
  positioning: string;
  competitors: string;
  pain_points: string;
  icp_meta_ads: string;
  icp_newsletter: string;
  icp_outreach: string;
  icp_cold_dm: string;
  icp_cold_call: string;
  icp_cold_sms: string;
  icp_blog: string;
  content_hash: string;
  label: string | null;
  created_at: string;
};

const BRAND_FIELDS = [
  "products_services",
  "value_proposition",
  "brand_voice",
  "positioning",
  "competitors",
  "pain_points",
  "icp_meta_ads",
  "icp_newsletter",
  "icp_outreach",
  "icp_cold_dm",
  "icp_cold_call",
  "icp_cold_sms",
  "icp_blog",
] as const;

export function profileFromDb(row: BrandConfigDbRow | null | undefined): BrandProfileData {
  return {
    productsAndServices: row?.products_services || "",
    valueProposition: row?.value_proposition || "",
    brandVoice: row?.brand_voice || "",
    positioning: row?.positioning || "",
    competitors: row?.competitors || "",
    painPoints: row?.pain_points || "",
    icpMetaAds: row?.icp_meta_ads || "",
    icpNewsletter: row?.icp_newsletter || "",
    icpOutreach: row?.icp_outreach || "",
    icpColdDm: row?.icp_cold_dm || "",
    icpColdCall: row?.icp_cold_call || "",
    icpColdSms: row?.icp_cold_sms || "",
    icpBlog: row?.icp_blog || "",
    destinationUrl: row?.destination_url || "",
  };
}

export function profileToDb(data: BrandProfileData): BrandConfigDbRow {
  return {
    products_services: data.productsAndServices,
    value_proposition: data.valueProposition,
    brand_voice: data.brandVoice,
    positioning: data.positioning,
    competitors: data.competitors,
    pain_points: data.painPoints,
    icp_meta_ads: data.icpMetaAds,
    icp_newsletter: data.icpNewsletter,
    icp_outreach: data.icpOutreach,
    icp_cold_dm: data.icpColdDm,
    icp_cold_call: data.icpColdCall,
    icp_cold_sms: data.icpColdSms,
    icp_blog: data.icpBlog,
    destination_url: data.destinationUrl,
  };
}

export function snapshotToProfile(snapshot: BrandSnapshot | BrandConfigDbRow): BrandProfileData {
  return profileFromDb(snapshot);
}

export function computeBrandConfigHash(payload: BrandConfigDbRow): string {
  const normalized = BRAND_FIELDS.map((key) => String(payload[key] ?? "").trim()).join("\x1e");
  return createHash("sha256").update(normalized).digest("hex");
}

export function buildSnapshotLabel(positioning: string, createdAt?: string): string {
  const preview = (positioning || "Brand snapshot").trim().slice(0, 60);
  const suffix = preview.length < (positioning || "").trim().length ? "…" : "";
  if (!createdAt) return `${preview}${suffix}`;
  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${preview}${suffix} · ${date}`;
}

export const BRAND_STRATEGY_FIELDS: { key: keyof BrandProfileData; label: string }[] = [
  { key: "productsAndServices", label: "Products & Services" },
  { key: "valueProposition", label: "Value Proposition" },
  { key: "brandVoice", label: "Brand Voice" },
  { key: "positioning", label: "Positioning" },
  { key: "competitors", label: "Competitors" },
  { key: "painPoints", label: "Pain Points" },
];

export const BRAND_ICP_FIELDS: { key: keyof BrandProfileData; label: string }[] = [
  { key: "icpMetaAds", label: "ICP - Meta Ads" },
  { key: "icpNewsletter", label: "ICP - Newsletter" },
  { key: "icpOutreach", label: "ICP - Cold Email" },
  { key: "icpColdDm", label: "ICP - Cold DM" },
  { key: "icpColdCall", label: "ICP - Cold Call" },
  { key: "icpColdSms", label: "ICP - Cold SMS" },
  { key: "icpBlog", label: "ICP - Blog" },
];

export const BRAND_DESTINATION_FIELD: { key: keyof BrandProfileData; label: string } = {
  key: "destinationUrl",
  label: "Destination URL (Meta Ads)",
};
