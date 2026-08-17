"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Badge,
  Card,
  MetricCard,
  SectionTitle,
  WorkflowStep,
  EmptyState,
  Spinner,
  SecondaryButton,
  EditorialPage,
  EditorialPageHeader,
  EditorialSectionHeader,
  EditorialStatRibbon,
  EditorialStatCell,
  EditorialPanelStatCell,
  EditorialMetricItem,
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialPillButton,
  EditorialTextLink,
  EditorialField,
  EditorialTabBar,
  EditorialStatusPill,
  EditorialListRow,
} from "./components";
import {
  User,
  LogOut,
  LogIn,
  ShieldCheck,
  ClipboardList,
  Megaphone,
  Tag,
  Gem,
  MessageSquare,
  Target,
  Users,
  AlertTriangle,
  LayoutGrid,
  Mail,
  Send,
  Info,
  LayoutDashboard,
  BarChart3,
  WandSparkles,
  Settings2,
  TrendingUp,
  Activity,
  PieChart,
  Share2,
  Newspaper,
  PenLine,
  Pencil,
  Search,
  History,
  Trash2,
  FileText,
  Sparkles,
  Phone,
  Smartphone,
  SlidersHorizontal,
  Library,
} from "lucide-react";
import OutreachTab from "./OutreachTab";
import NewsletterTab from "./NewsletterTab";
import BlogTab from "./BlogTab";
import { supabase, supabaseProjectUrl } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { tenantStorageKey } from "@/lib/tenant-storage";
import CampaignSetup from "./CampaignSetup";
import AdPerformance from "./AdPerformance";
import AdsLibrary, { ADS_LIBRARY_SCRAPE_EVENT } from "./AdsLibrary";
import GenerateVariants from "./GenerateVariants";
import SocialDash from "./SocialDash";
import SocialOverview from "./SocialOverview";
import CustomSelect from "./CustomSelect";
import VoiceExplorerModal from "./VoiceExplorerModal";
import { HideNextDevIndicator } from "@/components/HideNextDevIndicator";
import "./globals.css";
import { DEFAULT_WEBSITE_URL } from "@/lib/legacy-brand";
import { reportBelongsToCompany } from "@/lib/reports-query";
import {
  filterCountryOptions,
  META_AD_LIBRARY_COUNTRIES,
  resolveCountryFromInput,
} from "@/lib/competitor-analysis/countries";
import {
  BRAND_DESTINATION_FIELD,
  BRAND_ICP_FIELDS,
  BRAND_STRATEGY_FIELDS,
  filterBrandIcpFieldsByEnabledModules,
  profileFromDb,
  profileToDb,
  snapshotToProfile,
} from "@/lib/brand-config";
import type { ModuleId } from "@/lib/company-module-status";
import {
  CLIENT_DASHBOARD_NAVIGATE_EVENT,
  CLIENT_DASHBOARD_SET_TAB_EVENT,
  CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT,
} from "@/lib/client-dashboard-nav";
import {
  fetchActiveSocialStudioBackgroundJob,
  fetchSocialStudioBackgroundJob,
  getJobBackgroundRunStatus,
  isSocialStudioBackgroundJobDone,
  SOCIAL_STUDIO_GEN_KIND_KEY,
  SOCIAL_STUDIO_GEN_START_KEY,
  SOCIAL_STUDIO_JOB_EVENT,
  SOCIAL_STUDIO_JOB_ID_KEY,
} from "@/lib/social-studio/client-api";

// ─── CONSTANTS ───────────────────────────────────────────────
const COMPETITOR_ANALYSIS_API = "/api/competitor-analysis";
const CREATE_AD_IDEAS_API = "/api/create-ad/ideas";
const CREATE_AD_IMAGE_CONCEPTS_API = "/api/create-ad/image/concepts";
const CREATE_AD_IMAGE_GENERATE_API = "/api/create-ad/image/generate";
const CREATE_AD_IMAGE_FINALIZE_API = "/api/create-ad/image/finalize";
const CREATE_AD_KIE_POLL_API = "/api/create-ad/kie/poll";
const CREATE_AD_VIDEO_PROMPTS_API = "/api/create-ad/video/prompts";
const CREATE_AD_VIDEO_IMAGES_API = "/api/create-ad/video/images";
const CREATE_AD_VIDEO_IMAGES_MATCH_API = "/api/create-ad/video/images/match";
const CREATE_AD_VIDEO_CLIPS_API = "/api/create-ad/video/clips";
const CREATE_AD_VIDEO_CLIPS_MATCH_API = "/api/create-ad/video/clips/match";
const CREATE_AD_VIDEO_STITCH_API = "/api/create-ad/video/stitch";
const CREATE_AD_VIDEO_GENERATE_API = "/api/create-ad/video/generate";
const CREATE_AD_IMAGE_RUN_API = "/api/create-ad/image/run";
const CREATE_AD_JOBS_API = "/api/create-ad/jobs";
const CREATE_AD_JOB_ID_KEY = "app_create_ad_job_id";

const ANALYSIS_PIPELINE_PHASES = [
  {
    label: "Scraping Meta Ads Library",
    status: "Scraping competitor ads from Meta Ads Library…",
    durationMs: 150_000,
    progressEnd: 42,
  },
  {
    label: "Processing competitor ads",
    status: "Filtering and scoring competitor ads…",
    durationMs: 20_000,
    progressEnd: 55,
  },
  {
    label: "AI competitor analysis",
    status: "Running AI analysis on competitor data…",
    durationMs: 90_000,
    progressEnd: 88,
  },
  {
    label: "Generating insights",
    status: "Building your competitor intelligence report…",
    durationMs: 40_000,
    progressEnd: 97,
  },
] as const;

function getAnalysisProgressFromElapsed(elapsedMs: number) {
  let phaseStart = 0;
  for (let i = 0; i < ANALYSIS_PIPELINE_PHASES.length; i++) {
    const phase = ANALYSIS_PIPELINE_PHASES[i];
    const phaseEnd = phaseStart + phase.durationMs;
    const prevProgress = i === 0 ? 2 : ANALYSIS_PIPELINE_PHASES[i - 1].progressEnd;

    if (elapsedMs < phaseEnd) {
      const phaseRatio = (elapsedMs - phaseStart) / phase.durationMs;
      const progress = Math.round(prevProgress + (phase.progressEnd - prevProgress) * phaseRatio);
      return {
        progress: Math.min(progress, 97),
        phaseIndex: i,
        status: phase.status,
      };
    }
    phaseStart = phaseEnd;
  }

  const last = ANALYSIS_PIPELINE_PHASES[ANALYSIS_PIPELINE_PHASES.length - 1];
  return { progress: 97, phaseIndex: ANALYSIS_PIPELINE_PHASES.length - 1, status: last.status };
}
const VIDEO_GEN_DURATION = 360_000; // 6 minutes
const IMAGE_GEN_DURATION = 300_000;
const SOCIAL_STUDIO_IMAGE_GEN_DURATION = 300_000;
const SOCIAL_STUDIO_VIDEO_GEN_DURATION = 360_000;
const AD_COMPLETION_POLL_MS = 10_000;
const CREATE_AD_CLIENT_GEN_KEY = "app_create_ad_client_gen";
const IMAGE_GEN_START_KEY = "app_image_gen_start";
const PROMPT_GEN_START_KEY = "app_prompt_gen_start";
const KIE_POLL_MAX_WAIT_MS = 900_000; // 15 min — background tabs throttle timers; keep polling
const PROMPT_GEN_DURATION = 540_000; // 9 min

const DEFAULT_BRAND_CONFIG = {
  productsAndServices: "",
  valueProposition: "",
  brandVoice: "",
  positioning: "",
  competitors: "",
  painPoints: "",
  icpMetaAds: "",
  icpOutreach: "",
  icpColdDm: "",
  icpColdCall: "",
  icpColdSms: "",
  icpNewsletter: "",
  icpBlog: "",
  icpSocial: "",
  destinationUrl: "",
};

const ICP_FIELD_ICONS: Partial<Record<
  (typeof BRAND_ICP_FIELDS)[number]["key"],
  { iconEl: ReactNode; iconBg: string }
>> = {
  icpMetaAds: { iconEl: <LayoutGrid size={16} color="#059669" />, iconBg: "#ECFDF5" },
  icpOutreach: { iconEl: <Send size={16} color="#003049" />, iconBg: "#E7F0F6" },
  icpColdDm: { iconEl: <MessageSquare size={16} color="#DB2777" />, iconBg: "#FDF2F8" },
  icpColdCall: { iconEl: <Phone size={16} color="#EA580C" />, iconBg: "#FFF7ED" },
  icpColdSms: { iconEl: <Smartphone size={16} color="#669BBC" />, iconBg: "#E7F0F6" },
  icpNewsletter: { iconEl: <Mail size={16} color="#669BBC" />, iconBg: "#E7F0F6" },
  icpSocial: { iconEl: <Share2 size={16} color="#669BBC" />, iconBg: "#E7F0F6" },
  icpBlog: { iconEl: <PenLine size={16} color="#9333EA" />, iconBg: "#FAF5FF" },
};

const CONFIGURATION_TABS = [
  { id: "profile", label: "Brand and ICP", icon: User },
  { id: "analysis", label: "Competitors", icon: BarChart3 },
];

const META_ADS_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "ads_library", label: "Ads Library", icon: Library },
  { id: "create", label: "Create Ad", icon: WandSparkles },
  { id: "variants", label: "Generate Ad Variants", icon: Sparkles },
  { id: "campaigns", label: "Campaign Setup", icon: Settings2 },
  { id: "live_campaigns", label: "Campaign monitor", icon: TrendingUp },
  { id: "ad_performance", label: "Automated Campaigns", icon: Activity },
  { id: "reports", label: "Reports", icon: PieChart },
];

/** @deprecated Use META_ADS_TABS or CONFIGURATION_TABS */
const TABS = [...CONFIGURATION_TABS, ...META_ADS_TABS];

const SOCIAL_TABS = [
  { id: "social-overview", label: "Overview", icon: LayoutDashboard },
  { id: "social-creator-studio", label: "Creator Studio", icon: Sparkles },
];

const SOCIAL_TAB_IDS = new Set(SOCIAL_TABS.map((t) => t.id));

const NEWSLETTER_TABS = [
  { id: "newsletter-dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "newsletter-overview", label: "Settings", icon: Settings2 },
  { id: "newsletter-generate", label: "Generate Newsletter", icon: PenLine },
  { id: "newsletter-campaign", label: "Create Campaign", icon: Megaphone },
  { id: "newsletter-subscribers", label: "Subscribers", icon: User },
  { id: "newsletter-history", label: "History", icon: History },
  { id: "newsletter-services", label: "Manage Services", icon: Settings2 },
];

const NEWSLETTER_TAB_IDS = new Set(NEWSLETTER_TABS.map((t) => t.id));

const META_ADS_IDS = new Set(["overview", "ads_library", "create", "variants", "campaigns", "live_campaigns", "ad_performance", "reports"]);

const OUTREACH_FUTURE_TABS = [
  { id: "cold-dm", label: "Cold DM", icon: MessageSquare },
  { id: "cold-call", label: "Cold Call", icon: Phone },
  { id: "cold-sms", label: "Cold SMS", icon: Smartphone },
];

const OUTREACH_TABS = [
  { id: "outreach-dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "outreach-campaigns", label: "Email Messages", icon: Mail },
  { id: "outreach-analytics", label: "Cold Email Analytics", icon: BarChart3 },
  { id: "outreach-scraper", label: "Lead Scraper", icon: Search },
  { id: "outreach-scraper-history", label: "Scraper History", icon: History },
  { id: "outreach-cleanup", label: "Reset Lead Status", icon: Trash2 },
  { id: "outreach-settings", label: "Settings", icon: Settings2 },
];

const OUTREACH_FUTURE_IDS = new Set(OUTREACH_FUTURE_TABS.map((t) => t.id));

const OUTREACH_IDS = new Set([
  ...OUTREACH_TABS.map((t) => t.id),
  ...OUTREACH_FUTURE_TABS.map((t) => t.id),
]);

const BLOG_TABS = [
  { id: "blog-overview", label: "Overview", icon: LayoutDashboard },
  { id: "blog-post", label: "Blog Posts", icon: FileText },
  { id: "blog-automation", label: "Automation", icon: Sparkles },
];

const BLOG_IDS = new Set(BLOG_TABS.map((t) => t.id));
const CONFIGURATION_IDS = new Set(CONFIGURATION_TABS.map((t) => t.id));

const ALL_APP_TAB_IDS = new Set([
  ...CONFIGURATION_TABS.map((t) => t.id),
  ...META_ADS_TABS.map((t) => t.id),
  ...SOCIAL_TABS.map((t) => t.id),
  ...OUTREACH_TABS.map((t) => t.id),
  ...OUTREACH_FUTURE_TABS.map((t) => t.id),
  ...NEWSLETTER_TABS.map((t) => t.id),
  ...BLOG_TABS.map((t) => t.id),
]);

const DEFAULT_RESEARCH_KEYWORDS = [
  "tenant screening",
  "tenant background check",
  "landlord tenant screening",
  "rental applicant screening",
  "tenant credit check",
  "tenant verification",
  "rent guarantee insurance",
  "landlord screening platform",
];

const RESEARCH_KEYWORDS_KEY = "tenant_research_keywords_v2";

const isLegacyResearchKeywords = (keywords: unknown) =>
  !Array.isArray(keywords) ||
  keywords.length === 0 ||
  keywords.some((kw) =>
    /dental|hair transplant|medical tourism|hollywood smile|zirconium|fue hair|affordable dental/i.test(String(kw))
  );

const restoreResearchKeywords = (parsed: unknown) =>
  isLegacyResearchKeywords(parsed) ? DEFAULT_RESEARCH_KEYWORDS : parsed;

const TOPICS = [
  "Tenant Screening",
  "Background Checks",
  "Property Management",
  "Rent Protection",
  "Landlord Dashboard",
  "Rental Application Tracking",
  "AI Tenant Scoring",
];

// ─── HELPERS ─────────────────────────────────────────────────
/**
 * Ensures Supabase storage URLs use the current project's hostname.
 * This fixes issues where old data might use a different Supabase instance.
 */
const normalizeSupabaseUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  const currentUrl = supabaseProjectUrl;
  if (!currentUrl) return url;

  // If it's a Supabase storage URL
  if (url.includes("/storage/v1/object/")) {
    // Extract filename and bucket
    const parts = url.split("/object/");
    if (parts.length < 2) return url;

    const pathParts = parts[1].replace(/^(public\/|authenticated\/)/, "").split("/");
    const bucket = pathParts[0];
    const filename = pathParts.slice(1).join("/");

    if (!bucket || !filename) return url;

    // Reconstruct strictly using current credentials
    const newUrl = `${currentUrl}/storage/v1/object/public/${bucket}/${filename}`;

    if (url !== newUrl) {
      // URL normalized to current Supabase credentials
    }
    return newUrl;
  }
  return url;
};

/** Supabase may store Approved as boolean or "true"/"false" strings. */
function isAdApproved(approved: unknown): boolean {
  return approved === true || approved === "true";
}

/** Explicitly marked unapproved (user clicked Unapprove or row was set to false). */
function isAdExplicitlyUnapproved(approved: unknown): boolean {
  return approved === false || approved === "false" || approved === "False" || approved === "0";
}

function formatVideoDurationLabel(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function CreateAdPreviewMedia({
  url,
  isVideo,
  label,
  mediaMissing,
  onMediaMissing,
}: {
  url: string;
  isVideo: boolean;
  label: string;
  mediaMissing: boolean;
  onMediaMissing: () => void;
}) {
  const [durationLabel, setDurationLabel] = useState<string | null>(null);

  const frameStyle: CSSProperties = {
    width: "100%",
    aspectRatio: "4/5",
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    background: "#E8DCC2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (mediaMissing) {
    return (
      <div style={frameStyle}>
        <div style={{ fontSize: 12, color: "#780000", fontWeight: 600, textAlign: "center", padding: 20, lineHeight: 1.5 }}>
          Media no longer in Supabase storage
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div style={frameStyle}>
        <div style={{ fontSize: 11, color: "#8C8474", textAlign: "center", padding: 10 }}>
          Waiting for media…
        </div>
      </div>
    );
  }

  const mediaStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  return (
    <div style={frameStyle}>
      {isVideo ? (
        <video
          key={url}
          src={url}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const formatted = formatVideoDurationLabel(e.currentTarget.duration);
            if (formatted) setDurationLabel(formatted);
          }}
          onError={onMediaMissing}
          style={mediaStyle}
        />
      ) : (
        <img
          key={url}
          src={url}
          alt={label}
          onError={onMediaMissing}
          style={mediaStyle}
        />
      )}
      {isVideo && durationLabel && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            background: "rgba(0,48,73,0.85)",
            color: "#FDF6E3",
            fontSize: 11.5,
            fontWeight: 700,
            borderRadius: 999,
            padding: "4px 12px",
            pointerEvents: "none",
          }}
        >
          ▶ {durationLabel}
        </div>
      )}
    </div>
  );
}

function getAdJsonRecord(jsonData: any) {
  if (!jsonData || typeof jsonData !== "object") return {};
  return jsonData.ad || jsonData.ads?.[0] || jsonData;
}

function getAdDescription(jsonData: any): string {
  const record = getAdJsonRecord(jsonData);
  return String(record.primary_text || jsonData?.primary_text || "").trim();
}

function isStorageMediaUrl(url: unknown): boolean {
  if (!url || typeof url !== "string") return false;
  return url.includes("/storage/v1/object/") || /\.(png|jpe?g|webp|gif|mp4|mov|webm)(\?|$)/i.test(url.split("/").pop() || "");
}

function getAdDestinationUrl(jsonData: any): string {
  const record = getAdJsonRecord(jsonData);
  const candidates = [
    record.destination_url,
    record.website_url,
    jsonData?.destination_url,
    jsonData?.ad?.destination_url,
    jsonData?.ad?.website_url,
    jsonData?.ads?.[0]?.destination_url,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value && !isStorageMediaUrl(value)) return value;
  }
  const legacyLink = String(jsonData?.link_data || "").trim();
  if (legacyLink && !isStorageMediaUrl(legacyLink)) return legacyLink;
  return "";
}

function getAdSourcePrompt(ad: any, jsonData: any): string {
  const story = String(ad?.story || "").trim();
  if (story) return story;

  const record = getAdJsonRecord(jsonData);
  const prompt = String(record.prompt || jsonData?.prompt || "").trim();
  if (prompt) return prompt;

  const idea = String(record.idea || jsonData?.idea || "").trim();
  if (idea) return idea;

  return "";
}

const SELECT_ARROW_STYLE = {
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 34,
};

function getStorageFileName(url: unknown): string {
  if (!url || typeof url !== "string") return "";
  if (url.includes("/storage/v1/object/")) {
    const pathPart = url.split("/object/")[1]?.replace(/^(public\/|authenticated\/)/, "") || "";
    const segments = pathPart.split("/");
    if (segments.length >= 2) return segments.slice(1).join("/").split("?")[0];
  }
  return url.split("/").pop()?.split("?")[0] || "";
}

function getMarketInsightValue(table, ...labels) {
  if (!table?.length) return "";
  const lower = labels.map((l) => l.toLowerCase());
  const row = table.find((r) =>
    lower.some((l) => (r?.field || "").toLowerCase().includes(l))
  );
  return row?.value || "";
}

function getAnalysisInsightValue(analysis, ...labels) {
  const fromTable = getMarketInsightValue(analysis?.market_insights_table, ...labels);
  if (fromTable) return fromTable;
  const mi = analysis?.market_insights;
  if (mi && typeof mi === "object" && !Array.isArray(mi)) {
    for (const label of labels) {
      const key = Object.keys(mi).find((k) =>
        k.toLowerCase().includes(label.toLowerCase())
      );
      if (key && mi[key]) return String(mi[key]);
    }
  }
  return "";
}

function extractReadyScript(analysis, index = 0) {
  const scripts = analysis?.ready_ad_scripts || [];
  if (!scripts.length) return null;
  const item = scripts[index] ?? scripts[0];
  if (typeof item === "string") return item;
  return (
    item?.script ||
    item?.idea ||
    item?.storyboard ||
    item?.text ||
    item?.narrative ||
    null
  );
}

function buildStoryboardFromAnalysis(analysis, itemIndex = 0) {
  const ready = extractReadyScript(analysis, itemIndex);
  if (ready) return ready;

  const hooks = analysis?.hooks_table || [];
  const gaps = analysis?.gaps_table || analysis?.gap_opportunities || [];
  const angle = getAnalysisInsightValue(analysis, "angle");
  const framework = getAnalysisInsightValue(analysis, "framework");
  const cta = getAnalysisInsightValue(analysis, "cta");
  const format = getAnalysisInsightValue(analysis, "format");

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedGaps = [...gaps].sort(
    (a, b) =>
      (priorityOrder[a?.priority?.toLowerCase()] ?? 9) -
      (priorityOrder[b?.priority?.toLowerCase()] ?? 9)
  );
  const gap = sortedGaps[itemIndex] || sortedGaps[0];
  const hook = hooks[itemIndex] || hooks[0];

  const parts = [];
  if (gap?.opportunity) parts.push(gap.opportunity);
  else if (gap?.gap) parts.push(`Address the gap: ${gap.gap}`);

  if (hook?.example || hook?.pattern) {
    parts.push(
      `\n\nHook (${hook.pattern || "proven pattern"}): "${hook.example || hook.pattern}"`
    );
  }

  const context = [
    angle && `Angle: ${angle}`,
    framework && `Framework: ${framework}`,
    cta && `CTA: ${cta}`,
    format && `Format: ${format}`,
  ].filter(Boolean);
  if (context.length) parts.push(`\n\n${context.join(" | ")}`);

  if (!parts.length && analysis?.executive_summary) {
    return analysis.executive_summary.slice(0, 600);
  }

  return parts.join("").trim();
}

function parseFormatToAdType(format) {
  const f = String(format || "").toLowerCase();
  if (!f) return null;
  if (f.includes("video") || f.includes("reel") || f.includes("short")) return "video";
  if (f.includes("image") || f.includes("carousel") || f.includes("static") || f.includes("photo")) {
    return "image";
  }
  return null;
}

function sortGapsByPriority(gaps) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...(gaps || [])].sort(
    (a, b) =>
      (priorityOrder[a?.priority?.toLowerCase()] ?? 9) -
      (priorityOrder[b?.priority?.toLowerCase()] ?? 9)
  );
}

function inferDominantFormatFromSummary(analysis) {
  const summary = String(analysis?.executive_summary || "").toLowerCase();
  if (!summary) return null;
  if (
    /dominant\s+(ad\s+)?format[^.]{0,80}\bimage\b/.test(summary) ||
    /\bimage\s+ads?\b/.test(summary) ||
    /format\s+is\s+image/.test(summary)
  ) {
    return "image";
  }
  if (
    /dominant\s+(ad\s+)?format[^.]{0,80}\bvideo\b/.test(summary) ||
    /\bvideo\s+ads?\b/.test(summary) ||
    /format\s+is\s+video/.test(summary)
  ) {
    return "video";
  }
  return null;
}

function inferAdTypeFromAnalysis(analysis, index = 0) {
  const scripts = analysis?.ready_ad_scripts || [];
  const script = scripts[index] ?? scripts[0];
  if (script) {
    const fromScript = parseFormatToAdType(
      script.format || script.ad_format || script.type || script.media_type
    );
    if (fromScript) return fromScript;
  }

  const bestStart = analysis?.budget_recommendation?.best_ad_format_to_start;
  const fromBudget = parseFormatToAdType(bestStart);
  if (fromBudget) return fromBudget;

  const actionPlan = analysis?.action_plan || [];
  const firstAction =
    actionPlan.find((a) => Number(a?.priority) === 1) || actionPlan[0];
  if (firstAction) {
    const fromAction = parseFormatToAdType(firstAction.format);
    if (fromAction) return fromAction;
  }

  const dominant = getAnalysisInsightValue(analysis, "format");
  const fromDominant = parseFormatToAdType(dominant);
  if (fromDominant) return fromDominant;

  const fromSummary = inferDominantFormatFromSummary(analysis);
  if (fromSummary) return fromSummary;

  const gaps = sortGapsByPriority(analysis?.gaps_table || analysis?.gap_opportunities || []);
  const gap = gaps[index] ?? gaps[0];
  if (gap) {
    const fromGap = parseFormatToAdType(gap.ad_format);
    if (fromGap) return fromGap;
  }

  return "image";
}

function normalizeIdeaForAdType(idea, adType) {
  if (adType !== "image" || !idea) return idea;
  return idea
    .replace(/\bvideo\s+content\b/gi, "image ad creative")
    .replace(/\bvideo\s+ad\b/gi, "image ad")
    .replace(/\bshort[- ]form\s+video\b/gi, "static image ad")
    .replace(/\breel\b/gi, "carousel");
}

function ideaTextFromGenerated(ideaObj) {
  if (typeof ideaObj === "string") return ideaObj.trim();
  if (!ideaObj || typeof ideaObj !== "object") return "";
  return String(
    ideaObj.idea ||
      ideaObj.prompt ||
      ideaObj.image_prompt ||
      ideaObj.description ||
      ideaObj.concept ||
      ideaObj.text ||
      ideaObj.story ||
      ""
  ).trim();
}

type AnalysisResultSection =
  | "summary"
  | "competitors"
  | "hooks"
  | "market_insights"
  | "gaps"
  | "raw";

const COLLAPSED_ANALYSIS_SECTIONS: Record<AnalysisResultSection, boolean> = {
  summary: false,
  competitors: false,
  hooks: false,
  market_insights: false,
  gaps: false,
  raw: false,
};

const EXPANDED_ANALYSIS_SECTIONS: Record<AnalysisResultSection, boolean> = {
  summary: true,
  competitors: true,
  hooks: true,
  market_insights: true,
  gaps: true,
  raw: true,
};

function topicsMatch(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function parseSbReport(row) {
  let rd = row.report_data;
  try {
    if (typeof rd === "string") rd = JSON.parse(rd);
    if (Array.isArray(rd)) rd = rd[0] || {};
    return rd || {};
  } catch { return {}; }
}

function findMatchingAnalysisReport(rows, pendingTopic, startTime) {
  if (!pendingTopic || !Array.isArray(rows)) return null;
  return rows.find((row) => {
    const report = parseSbReport(row);
    if (!topicsMatch(report.topic, pendingTopic)) return false;
    if (!startTime || !row.created_at) return true;
    return new Date(row.created_at).getTime() >= startTime - 120_000;
  }) || null;
}

function formatAnalysisLastRun(iso: string | undefined | null): string {
  if (!iso) return "today";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "today";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (d >= startOfToday) return "today";
  if (d >= startOfYesterday) return "yesterday";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
  return `${day} ${mon} ${d.getFullYear()}`;
}

function formatResearchSortDisplay(sort: string): string {
  if (sort === "Newest First") return "Newest first";
  return "Impressions high → low";
}

function analysisThreatVariant(threat: string | undefined): "danger" | "unapproved" | "approved" | "neutral" {
  const level = threat?.toLowerCase();
  if (level === "high") return "danger";
  if (level === "medium") return "unapproved";
  if (level === "low") return "approved";
  return "neutral";
}

function analysisPriorityVariant(priority: string | undefined): "danger" | "unapproved" | "approved" | "neutral" {
  const level = priority?.toLowerCase();
  if (level === "high") return "danger";
  if (level === "medium") return "unapproved";
  if (level === "low") return "approved";
  return "neutral";
}

function CreateAdProgressPanel({
  statusLabel,
  progress,
  hint,
}: {
  statusLabel: string;
  progress: number;
  hint?: string;
}) {
  const showPct = progress > 0;
  return (
    <div
      role="status"
      style={{
        marginBottom: 16,
        padding: "16px 18px",
        borderRadius: 14,
        background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
        border: "1.5px solid #86efac",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: showPct ? 10 : 0,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spinner size={14} color="#16a34a" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{statusLabel}</span>
        </div>
        {showPct && (
          <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a" }}>{progress}%</span>
        )}
      </div>
      {showPct && (
        <div style={{ height: 8, background: "#bbf7d0", borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, progress)}%`,
              background:
                progress >= 100
                  ? "#16a34a"
                  : "linear-gradient(90deg, #22c55e, #16a34a)",
              borderRadius: 8,
              transition: "width 1.8s ease-out",
              boxShadow: "0 0 8px rgba(22,163,74,0.4)",
            }}
          />
        </div>
      )}
      {hint && (
        <div style={{ fontSize: 11, color: "#16a34a", marginTop: showPct ? 6 : 8 }}>{hint}</div>
      )}
    </div>
  );
}

function AnalysisDetailPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="editorial-analysis-detail-panel" style={{ borderBottom: "1px solid var(--border)", paddingLeft: 100, boxSizing: "border-box" }}>
      {children}
    </div>
  );
}

function AnalysisDetailRow({
  label,
  children,
  meta,
  isLast,
  variant = "numbered",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  meta?: React.ReactNode;
  isLast?: boolean;
  variant?: "numbered" | "field";
}) {
  const gridColumns = variant === "field" ? "120px 1fr" : "48px 1fr auto";
  return (
    <div
      className="editorial-analysis-detail-row"
      style={{
        display: "grid",
        gridTemplateColumns: gridColumns,
        gap: variant === "field" ? "0 32px" : "0 24px",
        padding: "18px 0",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        alignItems: "start",
      }}
    >
      <div style={{
        fontFamily: variant === "field" ? "var(--font-sans)" : "var(--font-display)",
        fontWeight: variant === "field" ? 400 : 600,
        fontSize: variant === "field" ? 12 : 15,
        letterSpacing: variant === "field" ? "0.04em" : undefined,
        textTransform: variant === "field" ? "uppercase" as const : undefined,
        color: variant === "field" ? "var(--text-muted)" : "var(--primary)",
        lineHeight: 1.35,
        paddingTop: variant === "field" ? 2 : 0,
      }}>
        {label}
      </div>
      <div style={{ minWidth: 0, fontSize: 14, lineHeight: 1.6, color: variant === "field" ? "#23394A" : "#4A5A64" }}>{children}</div>
      {meta ? <div style={{ textAlign: "right", flexShrink: 0 }}>{meta}</div> : variant === "numbered" ? <span /> : null}
    </div>
  );
}

function AnalysisScoreMeta({ value }: { value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--primary)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 4 }}>Score</div>
    </div>
  );
}

function AnalysisKeywordChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ border: "1px solid #C2B79A", borderRadius: 999, padding: "3px 10px", fontSize: 12.5, color: "#2B3A4A", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function AnalysisSummaryNavRow({
  title,
  subtitle,
  expanded,
  onClick,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr auto",
        gap: "0 40px",
        padding: "22px 0",
        borderBottom: "1px solid #E8DCC2",
        alignItems: "baseline",
        width: "100%",
        background: "none",
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,48,73,0.03)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "#003049" }}>{title}</span>
      {subtitle ? (
        <span style={{ fontSize: 14, color: "#8C8474" }}>{subtitle}</span>
      ) : (
        <span />
      )}
      <span style={{ color: "#C1121F", fontWeight: 700 }}>{expanded ? "↓" : "→"}</span>
    </button>
  );
}

function formatHookParamOption(row) {
  if (!row) return "";
  const pattern = row.pattern || "Hook";
  const example = row.example ? `: "${row.example}"` : "";
  return `${pattern}${example}`;
}

function formatGapParamOption(row) {
  if (!row) return "";
  if (row.opportunity) return String(row.opportunity);
  if (row.gap) return String(row.gap);
  return "";
}

function marketInsightValues(analysis, ...labels) {
  const table = analysis?.market_insights_table || [];
  const lower = labels.map((l) => l.toLowerCase());
  return table
    .filter((r) => lower.some((l) => (r?.field || "").toLowerCase().includes(l)))
    .map((r) => r?.value)
    .filter(Boolean)
    .map(String);
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function buildCreateAdParameterOptions(analysis) {
  const hooks = analysis?.hooks_table || [];
  const gaps = sortGapsByPriority(analysis?.gaps_table || analysis?.gap_opportunities || []);
  return {
    hookPattern: hooks.map(formatHookParamOption).filter(Boolean),
    angle: uniqueStrings(marketInsightValues(analysis, "angle")),
    framework: uniqueStrings(marketInsightValues(analysis, "framework")),
    gapOpportunity: gaps.map(formatGapParamOption).filter(Boolean),
    ctaPattern: uniqueStrings(marketInsightValues(analysis, "cta")),
  };
}

function buildCreateAdParameterDefaults(analysis) {
  const options = buildCreateAdParameterOptions(analysis);
  return {
    hookPattern: options.hookPattern[0] || "",
    angle: options.angle[0] || getAnalysisInsightValue(analysis, "angle") || "",
    framework: options.framework[0] || getAnalysisInsightValue(analysis, "framework") || "",
    gapOpportunity: options.gapOpportunity[0] || "",
    ctaPattern: options.ctaPattern[0] || getAnalysisInsightValue(analysis, "cta") || "",
  };
}

function emptyCreateAdParams() {
  return {
    hookPattern: "",
    angle: "",
    framework: "",
    gapOpportunity: "",
    ctaPattern: "",
  };
}

function hasCreateAdParams(adParams) {
  if (!adParams || typeof adParams !== "object") return false;
  return Object.values(adParams).some((v) => String(v || "").trim());
}

function buildCreateTabConfigFromAnalysis(analysis, prevConfig) {
  const scripts = analysis?.ready_ad_scripts || [];
  const scriptIndex = scripts.length > 0 ? scripts.length - 1 : 0;
  const existing = prevConfig.items[0];
  const id = existing?.id || Date.now();
  const adType = inferAdTypeFromAnalysis(analysis, scriptIndex);
  const adParams = buildCreateAdParameterDefaults(analysis);

  const item =
    adType === "video"
      ? {
          id,
          type: "video",
          duration: existing?.duration || "28 seconds",
          audioStyle: existing?.audioStyle || "Background Music",
          videoStyle: existing?.videoStyle || "Bold & Colorful",
          language: existing?.language || "English",
          character: existing?.character || "male",
          voiceId: existing?.voiceId || "rTOopItG6FIkKMIVxsl5",
          idea: "",
          adParams,
        }
      : {
          id,
          type: "image",
          imageStyle: existing?.imageStyle || "Bold & Colorful",
          idea: "",
          adParams,
        };

  return {
    totalAds: 1,
    videoCount: adType === "video" ? 1 : 0,
    imageCount: adType === "image" ? 1 : 0,
    items: [item],
  };
}

function CreateAdParametersBlock({
  item,
  idx,
  isVideo,
  analysisData,
  adStatus,
  adScenesGenerating,
  sentIdeaIds,
  generatedIdeas,
  onUpdateAdParam,
  onUpdateIdea,
  onGenerateIdeas,
  onClearGeneratedIdeas,
}) {
  const paramOptions = buildCreateAdParameterOptions(analysisData || {});
  const adParams = item.adParams || emptyCreateAdParams();
  const paramsReady = hasCreateAdParams(adParams);
  const ideaList = generatedIdeas[item.id];
  const accent = isVideo ? "#003049" : "#92400e";
  const accentBorder = isVideo ? "#bae6fd" : "#fde68a";
  const accentBg = isVideo ? "linear-gradient(135deg, #f0f9ff, #e0f2fe)" : "linear-gradient(135deg, #fffbeb, #fef3c7)";
  const generateLabel = isVideo ? "✨ Generate an idea" : "✨ Generate image prompt";
  const promptLabel = isVideo ? (
    <>Script / Storyboard Idea</>
  ) : (
    <>Image Description / Prompt</>
  );
  const generateDisabled = sentIdeaIds[item.id] || !paramsReady;

  const toSelectOptions = (values, current) => {
    const list = [...(values || [])];
    if (current && !list.includes(current)) list.unshift(current);
    const opts = list.map((v) => ({ value: v, label: v }));
    if (!opts.length) opts.push({ value: "", label: "— Run analysis first —" });
    else if (!current) opts.unshift({ value: "", label: "Select…" });
    return opts;
  };

  const paramFields = [
    { key: "hookPattern", label: "Top Hook Patterns", options: paramOptions.hookPattern },
    { key: "angle", label: "Angle", options: paramOptions.angle },
    { key: "framework", label: "Framework", options: paramOptions.framework },
    { key: "gapOpportunity", label: "Gap Opportunities", options: paramOptions.gapOpportunity },
    { key: "ctaPattern", label: "CTA Pattern", options: paramOptions.ctaPattern },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1.5px solid #E8DCC2",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1.5px solid #E8DCC2",
            background: "#FDF6E3",
            fontSize: 13,
            fontWeight: 800,
            color: "#003049",
            letterSpacing: "0.02em",
          }}
        >
          Prompt Parameters
        </div>
      </div>

      <div
        className="create-ad-params-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {paramFields.map(({ key, label, options }) => (
          <div key={key} style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#8C8474",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                lineHeight: 1.3,
              }}
            >
              {label}
            </div>
            <CustomSelect
              value={adParams[key] || ""}
              onChange={(v) => onUpdateAdParam(idx, key, v)}
              options={toSelectOptions(options, adParams[key])}
            />
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: isVideo ? "#003049" : "#92400e",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {promptLabel}
          </div>
          {adStatus !== "generating" && !adScenesGenerating[item.id] && (
            <button
              type="button"
              disabled={generateDisabled}
              onClick={() => onGenerateIdeas(idx, item, isVideo)}
              title={!paramsReady ? "Select prompt parameters from competitor analysis first" : undefined}
              style={{
                padding: "5px 12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: generateDisabled
                  ? "#9FA8A3"
                  : isVideo
                    ? "linear-gradient(135deg, #003049, #38bdf8)"
                    : "linear-gradient(135deg, #b45309, #d97706)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                cursor: generateDisabled ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                textTransform: "uppercase",
                opacity: generateDisabled ? 0.6 : 1,
                boxShadow: generateDisabled
                  ? "none"
                  : isVideo
                    ? "0 3px 10px rgba(2,132,199,0.4)"
                    : "0 3px 10px rgba(217,119,6,0.4)",
              }}
            >
              {sentIdeaIds[item.id] ? "✨ Generating..." : generateLabel}
            </button>
          )}
        </div>
        <textarea
          placeholder={
            isVideo
              ? "Describe your video concept, offer, or story angle…"
              : "Describe the aesthetic, colors, and subject of the image…"
          }
          value={item.idea}
          disabled={!!sentIdeaIds[item.id]}
          onChange={(e) => onUpdateIdea(idx, e.target.value)}
          style={{
            width: "100%",
            minHeight: 80,
            padding: "12px",
            borderRadius: "var(--radius-md)",
            border: isVideo
              ? `1.5px solid ${item.idea?.trim() ? "#bae6fd" : "#E8DCC2"}`
              : "1.5px solid #fde68a",
            background: sentIdeaIds[item.id] ? "#FDF6E3" : "#fff",
            fontSize: 12,
            outline: "none",
            color: isVideo ? "#1A4A66" : "#78350f",
            resize: "vertical",
            fontFamily: "inherit",
            cursor: sentIdeaIds[item.id] ? "not-allowed" : "auto",
            boxSizing: "border-box",
          }}
        />
      </div>

      {ideaList && ideaList.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "16px",
            borderRadius: 12,
            border: `1.5px solid ${accentBorder}`,
            background: accentBg,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            ✨ AI Generated Ideas — Click to use
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {ideaList.map((ideaObj, ideaIndex) => (
              <div
                key={`${item.id}-idea-${ideaIndex}`}
                onClick={() => {
                  onUpdateIdea(idx, ideaTextFromGenerated(ideaObj));
                  onClearGeneratedIdeas(item.id);
                }}
                style={{
                  padding: "13px 16px",
                  borderRadius: 10,
                  border: `1.5px solid ${accentBorder}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  color: isVideo ? "#1A4A66" : "#78350f",
                  transition: "all 0.18s",
                  lineHeight: 1.6,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accent;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = accentBorder;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {ideaTextFromGenerated(ideaObj)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── PERSISTENT LOCAL STORAGE HOOK ──────────────────────────
/**
 * Works like useState but automatically persists to/from localStorage.
 * Highly robust and SSR/Hydration safe for Next.js.
 */
function useLocalStorage(key, defaultValue, onRestore = null) {
  const [value, setValue] = useState(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on client-side mount
  useEffect(() => {
    setIsHydrated(false);
    const timer = setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          setValue(onRestore ? onRestore(parsed) : parsed);
        }
      } catch (e) {
        console.warn(`LocalStorage read error for key "${key}":`, e);
      } finally {
        setIsHydrated(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [key]);

  // Persist updates to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`LocalStorage write error for key "${key}":`, e);
    }
  }, [key, value, isHydrated]);

  return [value, setValue, isHydrated];
}

function readEmbedTabFromUrl() {
  if (typeof window === "undefined") return "overview";
  const params = new URLSearchParams(window.location.search);
  if (params.get("embed") !== "1") return "overview";
  const urlTab = params.get("tab");
  return urlTab && ALL_APP_TAB_IDS.has(urlTab) ? urlTab : "overview";
}

function isEmbedMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const companyId = session?.user?.companyId ?? null;
  const [storedTab, setStoredTab] = useLocalStorage(tenantStorageKey(companyId, "app_active_tab"), "overview");
  const [embedTab, setEmbedTab] = useState(readEmbedTabFromUrl);
  const embedTabRef = useRef(embedTab);
  embedTabRef.current = embedTab;
  const [embed, setEmbed] = useState(isEmbedMode);
  const tab = embed ? embedTab : storedTab;

  const syncTabFromParent = useCallback((value) => {
    setEmbedTab(value);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  const setTab = useCallback(
    (value) => {
      if (embed) {
        setEmbedTab(value);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", value);
          window.history.replaceState(null, "", url.toString());
          if (window.parent !== window) {
            window.parent.postMessage(
              { type: CLIENT_DASHBOARD_NAVIGATE_EVENT, tabId: value },
              window.location.origin
            );
          }
        }
      } else {
        setStoredTab(value);
      }
    },
    [embed, setStoredTab]
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(tenantStorageKey(companyId, "app_sidebar_collapsed"), false);
  const [metaAdsOpen, setMetaAdsOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [blogOpen, setBlogOpen] = useState(false);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [integrationsConfigured, setIntegrationsConfigured] = useState<boolean | null>(null);
  const [enabledModuleIds, setEnabledModuleIds] = useState<Set<ModuleId> | null>(null);
  const [moduleAccessLoaded, setModuleAccessLoaded] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[1]);
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get("embed") === "1";
    setEmbed(isEmbed);
    const urlTab = params.get("tab");
    if (!urlTab || !ALL_APP_TAB_IDS.has(urlTab)) return;
    if (isEmbed) setEmbedTab(urlTab);
    else setStoredTab(urlTab);
  }, [setStoredTab]);

  // Parent sidebar navigation — switch tab without reloading the iframe
  useEffect(() => {
    if (!embed) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== CLIENT_DASHBOARD_SET_TAB_EVENT) return;
      const tabId = event.data?.tabId;
      if (typeof tabId !== "string" || !ALL_APP_TAB_IDS.has(tabId)) return;
      if (tabId === embedTabRef.current) return;
      syncTabFromParent(tabId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed, syncTabFromParent]);

  // Embedded section iframes (Outreach, Newsletter, Blog) — sync sidebar when they navigate internally
  useEffect(() => {
    if (embed) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== CLIENT_DASHBOARD_NAVIGATE_EVENT) return;
      const tabId = event.data?.tabId;
      if (typeof tabId !== "string" || !ALL_APP_TAB_IDS.has(tabId)) return;
      setTab(tabId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed, setTab]);

  // Keep only the active module expanded in the sidebar
  useEffect(() => {
    setMetaAdsOpen(META_ADS_IDS.has(tab));
    setOutreachOpen(OUTREACH_TABS.some((t) => t.id === tab));
    setNewsletterOpen(NEWSLETTER_TABS.some((t) => t.id === tab));
    setSocialOpen(SOCIAL_TAB_IDS.has(tab));
    setBlogOpen(BLOG_IDS.has(tab));
    setConfigurationOpen(CONFIGURATION_IDS.has(tab));
  }, [tab]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      setModuleAccessLoaded(false);
      setEnabledModuleIds(null);
      return;
    }
    fetch("/api/companies/integrations/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setIntegrationsConfigured(data?.configured === true);
        if (Array.isArray(data?.modules)) {
          setEnabledModuleIds(
            new Set(
              data.modules.filter((m: { enabled?: boolean }) => m.enabled !== false).map((m: { id: ModuleId }) => m.id)
            )
          );
        } else {
          setEnabledModuleIds(null);
        }
      })
      .catch(() => {
        setIntegrationsConfigured(false);
        setEnabledModuleIds(null);
      })
      .finally(() => setModuleAccessLoaded(true));
  }, [sessionStatus]);

  useEffect(() => {
    if (!embed || integrationsConfigured !== false || !moduleAccessLoaded) return;
    if (CONFIGURATION_IDS.has(tab)) return;
    setTab("profile");
  }, [embed, integrationsConfigured, moduleAccessLoaded, tab, setTab]);

  // Migrate legacy tab ids from localStorage
  useEffect(() => { if (tab === "outreach") setTab("outreach-dashboard"); }, [tab, setTab]);
  useEffect(() => { if (tab === "newsletter") setTab("newsletter-generate"); }, [tab, setTab]);
  useEffect(() => { if (tab === "blog-management") setTab("blog-overview"); }, [tab, setTab]);
  useEffect(() => { if (tab === "social-dash") setTab("social-creator-studio"); }, [tab, setTab]);
  useEffect(() => { if (tab === "social-automation") setTab("social-overview"); }, [tab, setTab]);
  useEffect(() => { if (tab === "approval") setTab("create"); }, [tab, setTab]);


  // Analysis state — status and data persist across refresh
  const [analysisStatus, setAnalysisStatus] = useLocalStorage("app_analysis_status", "idle");
  // idle | generating | done | error
  const [analysisData, setAnalysisData] = useLocalStorage("app_analysis_data", null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhaseIndex, setAnalysisPhaseIndex] = useState(0);
  const [analysisStatusMessage, setAnalysisStatusMessage] = useState<string>(ANALYSIS_PIPELINE_PHASES[0].status);

  const [analysisError, setAnalysisError] = useState("");
  const [analysisCardsExpanded, setAnalysisCardsExpanded] = useState(COLLAPSED_ANALYSIS_SECTIONS);
  const freshAnalysisResultRef = useRef(false);
  const prevAnalysisDataIdRef = useRef<string | null>(null);
  const createTabAnalysisSyncIdRef = useRef<string | null>(null);
  const [pendingAnalysisTopic, setPendingAnalysisTopic] = useLocalStorage("app_pending_analysis_topic", null);
  const pendingTopicRef = useRef<string | null>(null); // ref so realtime callback always sees latest value
  const companySlugRef = useRef<string | null>(null);
  const analysisInFlightRef = useRef(false);
  const prevTabRef = useRef<string | null>(null);
  useEffect(() => { pendingTopicRef.current = pendingAnalysisTopic; }, [pendingAnalysisTopic]);

  const expandAllAnalysisSections = useCallback(() => {
    setAnalysisCardsExpanded({ ...EXPANDED_ANALYSIS_SECTIONS });
  }, []);

  const expandTopicCollapseResults = useCallback(() => {
    setAnalysisCardsExpanded({ ...COLLAPSED_ANALYSIS_SECTIONS });
  }, []);

  const collapseAllAnalysisSections = useCallback(() => {
    setAnalysisCardsExpanded({ ...COLLAPSED_ANALYSIS_SECTIONS });
  }, []);

  const toggleAnalysisSection = useCallback((section: AnalysisResultSection) => {
    setAnalysisCardsExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const visibleAnalysisSections = useMemo((): AnalysisResultSection[] => {
    if (!analysisData) return [];
    const sections: AnalysisResultSection[] = [];
    if (analysisData.executive_summary) sections.push("summary");
    if (analysisData.competitors_table?.length > 0) sections.push("competitors");
    if (analysisData.hooks_table?.length > 0) sections.push("hooks");
    if (analysisData.market_insights_table?.length > 0) sections.push("market_insights");
    if (analysisData.gaps_table?.length > 0) sections.push("gaps");
    const hasTables = sections.length > 0;
    if (
      !hasTables &&
      !analysisData.message?.toLowerCase().includes("workflow")
    ) {
      sections.push("raw");
    }
    return sections;
  }, [analysisData]);

  const expandableAnalysisSections = useMemo(
    () => visibleAnalysisSections.filter((section) => section !== "summary"),
    [visibleAnalysisSections],
  );

  const hasAnalysisResultCards = expandableAnalysisSections.length > 0;

  const allAnalysisSectionsExpanded = useMemo(() => {
    return (
      expandableAnalysisSections.length === 0 ||
      expandableAnalysisSections.every((section) => analysisCardsExpanded[section])
    );
  }, [expandableAnalysisSections, analysisCardsExpanded]);

  const toggleAllAnalysisSections = useCallback(() => {
    if (allAnalysisSectionsExpanded) {
      collapseAllAnalysisSections();
    } else {
      expandAllAnalysisSections();
    }
  }, [allAnalysisSectionsExpanded, collapseAllAnalysisSections, expandAllAnalysisSections]);

  useEffect(() => {
    if (analysisStatus !== "done" || !analysisData) return;

    const dataId = analysisData.id ?? analysisData.topic ?? "current";

    if (freshAnalysisResultRef.current) {
      expandTopicCollapseResults();
      freshAnalysisResultRef.current = false;
      prevAnalysisDataIdRef.current = dataId;
      return;
    }

    if (prevAnalysisDataIdRef.current !== dataId) {
      expandTopicCollapseResults();
      prevAnalysisDataIdRef.current = dataId;
    }
  }, [analysisStatus, analysisData, expandTopicCollapseResults]);

  // Custom keywords research form states
  const [researchKeywords, setResearchKeywords] = useLocalStorage(
    RESEARCH_KEYWORDS_KEY,
    DEFAULT_RESEARCH_KEYWORDS,
    restoreResearchKeywords
  );

  // Drop superseded localStorage keys from legacy defaults
  useEffect(() => {
    if (typeof window === "undefined") return;
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("toga_")) {
        const migrated = "app_" + key.slice(5);
        if (localStorage.getItem(migrated) === null) {
          const val = localStorage.getItem(key);
          if (val !== null) localStorage.setItem(migrated, val);
        }
        localStorage.removeItem(key);
      }
    });
    window.localStorage.removeItem("toga_research_keywords");
    window.localStorage.removeItem("tenant_research_keywords");
  }, []);
  const [keywordInput, setKeywordInput] = useState("");
  const [researchCountries, setResearchCountries] = useLocalStorage("app_research_countries", ["CA", "US"]);
  const [locationSearchInput, setLocationSearchInput] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  const addResearchCountryFromInput = useCallback(() => {
    const match = resolveCountryFromInput(locationSearchInput);
    if (!match) return;
    setResearchCountries((prev) => (prev.includes(match.shortcut) ? prev : [...prev, match.shortcut]));
    setLocationSearchInput("");
    setShowLocationDropdown(false);
  }, [locationSearchInput, setResearchCountries]);

  const [researchMaxAds, setResearchMaxAds] = useLocalStorage("app_research_max_ads", 100);
  const [researchScrapeImage, setResearchScrapeImage] = useLocalStorage("app_research_scrape_image", true);
  const [researchScrapeVideo, setResearchScrapeVideo] = useLocalStorage("app_research_scrape_video", true);
  const [researchOnlyActive, setResearchOnlyActive] = useLocalStorage("app_research_only_active", true);
  const [researchSort, setResearchSort] = useLocalStorage("app_research_sort", "Impressions High → Low");

  // Sync first keyword to selectedTopic for compatibility with other tabs
  useEffect(() => {
    const firstKeyword = researchKeywords[0];
    if (firstKeyword && firstKeyword !== selectedTopic) {
      setSelectedTopic(firstKeyword);
    }
  }, [researchKeywords, selectedTopic]);

  // Ad creation
  // "generating" = in-flight browser fetch; a refresh kills that request so always restore as "idle"
  const [adStatus, setAdStatus] = useLocalStorage("app_ad_status", "idle", (v) => {
    if (v !== "generating") return v;
    if (typeof window === "undefined") return "idle";
    const clientGen = window.localStorage.getItem(CREATE_AD_CLIENT_GEN_KEY);
    const promptStart = window.localStorage.getItem(PROMPT_GEN_START_KEY);
    if (clientGen && promptStart) return "generating";
    return "idle";
  });
  // idle | generating | waiting | done | error
  const [adData, setAdData] = useLocalStorage("app_ad_data", null);

  // Approval & launch
  const [approved, setApproved] = useState(false);
  const [budget, setBudget] = useLocalStorage("app_budget", 50);
  const [duration, setDuration] = useLocalStorage("app_duration", 7);
  const [launchStatus, setLaunchStatus] = useState("idle");
  // idle | launching | live | error

  // Campaigns
  const [campaigns, setCampaigns] = useState([]);

  // Report
  const [reportStatus, setReportStatus] = useState("idle");
  // idle | generating | done | error



  // Shared error
  const [webhookError, setWebhookError] = useState("");

  // Ad scenes (generated prompts per ad item)
  const [adScenesMap, setAdScenesMap] = useState({});       // { [itemId]: scenesArray }
  const [adAudioKeysMap, setAdAudioKeysMap] = useState<any>({}); // { [itemId]: audioKey }
  const [adAudioUrlsMap, setAdAudioUrlsMap] = useState<any>({}); // { [itemId]: audioUrl }
  const [adScenesGenerating, setAdScenesGenerating] = useState({}); // { [itemId]: boolean }
  const [scenesModal, setScenesModal] = useState({ open: false, scenes: [], adLabel: "", itemId: null });
  const [editedScenes, setEditedScenes] = useState([]);     // editable copy of scenes in modal
  const [failedPrompts, setFailedPrompts] = useState<Array<{ taskId: string; prompt: string; failMsg: string }>>([]);
  const [voiceModalOpenForId, setVoiceModalOpenForId] = useState<number | null>(null);
  const [voiceLabels, setVoiceLabels] = useState<Record<number, string>>({});
  const [failedImagePrompts, setFailedImagePrompts] = useState<Array<{ prompt: string; reason: string; index: number }>>([]);
  const [editingImagePrompt, setEditingImagePrompt] = useState<{ open: boolean; index: number; prompt: string; reason: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Approval queue
  const [scheduledAds, setScheduledAds] = useState([]);
  const [approvedAds, setApprovedAds] = useState([]);
  const [rejectedAds, setRejectedAds] = useState([]);
  const [adCardStatuses, setAdCardStatuses] = useState({});
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(null);
  const [scheduleDates, setScheduleDates] = useState({});

  // ── Ad Videos state ──
  const [adVideosLoading, setAdVideosLoading] = useState(true); // true on mount so skeleton shows until first load

  // ── Supabase reports state ──
  const [sbRows, setSbRows] = useState([]);
  const [adsLabView, setAdsLabView] = useState<"analysis" | "pastRuns">("analysis");

  const analysisLastRunLabel = useMemo(() => {
    if (!analysisData) return null;
    const matchedRow = sbRows.find((row: any) => row.id === analysisData.id);
    const iso = matchedRow?.created_at || analysisData.created_at;
    return formatAnalysisLastRun(iso);
  }, [analysisData, sbRows]);

  const [hoveredInputs, setHoveredInputs] = useState<any>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const positionPastRunHoverPopup = useCallback((clientX: number, clientY: number, data: any) => {
    const popupWidth = 360;
    const popupHeight = 420;
    const gap = 12;
    const isLeftHalf = clientX < window.innerWidth / 2;
    let x = isLeftHalf ? clientX + gap : clientX - popupWidth - gap;
    x = Math.max(gap, Math.min(x, window.innerWidth - popupWidth - gap));
    let y = clientY - 24;
    y = Math.max(gap, Math.min(y, window.innerHeight - popupHeight - gap));
    setHoveredInputs({ data, x, y });
  }, []);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [errorNotificationTime, setErrorNotificationTime] = useState<string | null>(null);

  // ── Profile Form Data (Supabase Integration) ──
  const [profileData, setProfileData] = useState<any>({ ...DEFAULT_BRAND_CONFIG });
  const [profileId, setProfileId] = useState<string>("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSectionsExpanded, setProfileSectionsExpanded] = useState(true);
  const [brandSnapshots, setBrandSnapshots] = useState<any[]>([]);
  const [brandSnapshotsModalOpen, setBrandSnapshotsModalOpen] = useState(false);
  const [loadingBrandSnapshots, setLoadingBrandSnapshots] = useState(false);
  const [brandSnapshotsLoaded, setBrandSnapshotsLoaded] = useState(false);
  const [expandedBrandSnapshotId, setExpandedBrandSnapshotId] = useState<string | null>(null);
  const [activeBrandSnapshot, setActiveBrandSnapshot, activeBrandSnapshotHydrated] = useLocalStorage(
    tenantStorageKey(companyId, "app_active_brand_snapshot"),
    null
  );
  const [templateNameModalOpen, setTemplateNameModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [pendingSnapshotPayload, setPendingSnapshotPayload] = useState<any>(null);
  const [isSavingTemplateName, setIsSavingTemplateName] = useState(false);
  const [isEditingActiveTemplateLabel, setIsEditingActiveTemplateLabel] = useState(false);
  const [activeTemplateLabelDraft, setActiveTemplateLabelDraft] = useState("");
  const [isSavingActiveTemplateLabel, setIsSavingActiveTemplateLabel] = useState(false);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const fetchProfile = async () => {
      const res = await fetch("/api/brand-config");
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setProfileId(data.id);
        setProfileData({
          ...DEFAULT_BRAND_CONFIG,
          ...profileFromDb(data),
        });
      }
    };
    fetchProfile();
  }, [companyId]);

  // ── Poll for global workflow errors directly from Supabase (RLS disabled) ──
  // Strategy: track the DISMISSED ERROR MESSAGE (not timestamp).
  // This way, even if the error row updates updated_at every few seconds with the same error,
  // the alert stays dismissed until a genuinely NEW/DIFFERENT error message appears.
  useEffect(() => {
    let active = true;

    const checkErrors = async () => {
      try {
        const { data, error } = await supabase
          .from("Error Alerts")
          .select("Error")
          .eq("id", 1)
          .maybeSingle();

        if (!active) return;
        if (error || !data) {
          setErrorNotification(null);
          setErrorNotificationTime(null);
          return;
        }

        const errMsg: string = (data.Error || "").trim();

        if (!errMsg) {
          setErrorNotification(null);
          setErrorNotificationTime(null);
          return;
        }

        // Only show if this exact error message has not been dismissed before
        const lastDismissedMsg = localStorage.getItem("app_last_dismissed_error_msg") || "";
        if (errMsg !== lastDismissedMsg) {
          setErrorNotification(errMsg);
          setErrorNotificationTime(errMsg); // reuse state field to carry the key for dismiss
          // If a video generation is in progress, stop the stuck progress bar
          if (localStorage.getItem("app_video_gen_start")) {
            stopVideoGenProgress(false);
          }
        } else {
          setErrorNotification(null);
          setErrorNotificationTime(null);
        }
      } catch (err) {
        console.error("[UI] Error checking notifications:", err);
      }
    };

    // Check instantly on mount
    checkErrors();

    // Check every 5 seconds
    const interval = setInterval(checkErrors, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const dismissError = useCallback(async (msg: string) => {
    if (!msg) return;
    localStorage.setItem("app_last_dismissed_error_msg", msg.trim());
    try {
      await supabase
        .from("Error Alerts")
        .update({ Error: "" })
        .eq("id", 1);
    } catch (e) {
      console.warn("Could not clear error from Supabase:", e);
    }
    setErrorNotification(null);
    setErrorNotificationTime(null);
  }, []);

  // Error notification stays visible until user manually closes it

  const [sbLoading, setSbLoading] = useState(true);
  const [sbToasts, setSbToasts] = useState([]);
  const [sbExpandedInsights, setSbExpandedInsights] = useState({});
  const [sbAdsConfigOpen, setSbAdsConfigOpen] = useState({});
  const [sbAdsConfigs, setSbAdsConfigs] = useState({});
  const [sbModalReport, setSbModalReport] = useState(null);
  const [sbModalTab, setSbModalTab] = useState("competitors");
  const [sbSortField, setSbSortField] = useState("score");
  const [sbSortDir, setSbSortDir] = useState("desc");

  const [createTabAdsConfig, setCreateTabAdsConfig] = useState<any>({
    totalAds: 1,
    videoCount: 1,
    imageCount: 0,
    items: [
      { id: Date.now(), type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", language: "English", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5", adParams: emptyCreateAdParams() }
    ]
  });
  const [createTabConfigOpen, setCreateTabConfigOpen] = useState(false);
  const [pendingAds, setPendingAds] = useState([]);
  const [pendingAdsCount, setPendingAdsCount] = useState(0);
  const [adTableLinks, setAdTableLinks] = useState({});
  // Stores { "1": { text: "...", format: "Video", Approved: bool }, ... }
  const [allApprovedAds, setAllApprovedAds] = useState([]);
  const [allPreviewAds, setAllPreviewAds] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [unapprovingId, setUnapprovingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [previewMediaFilter, setPreviewMediaFilter] = useState("all");
  const [previewStatusFilter, setPreviewStatusFilter] = useState("");
  const [missingMediaKeys, setMissingMediaKeys] = useState<Set<string>>(() => new Set());
  const [selectedAdForDetails, setSelectedAdForDetails] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useLocalStorage("app_workflow_status", "");
  // If no active video generation (no start timestamp), stale isStatusPolling=true should reset
  const [isStatusPolling, setIsStatusPolling] = useLocalStorage("app_is_status_polling", false,
    (v) => (v === true && typeof window !== "undefined" && !localStorage.getItem("app_video_gen_start") ? false : v));
  const [isEditingAd, setIsEditingAd] = useState(false);
  const [editingAdData, setEditingAdData] = useState<any>({});
  const [isSavingAd, setIsSavingAd] = useState(false);
  const [isRetryingAd, setIsRetryingAd] = useState(false);
  const [sentIdeaIds, setSentIdeaIds] = useState({});
  const [generatedIdeas, setGeneratedIdeas] = useState({});
  const [retryPrompt, setRetryPrompt] = useState("");
  const [isRetryingSubmit, setIsRetryingSubmit] = useState(false);
  const [acceptingPrompts, setAcceptingPrompts] = useState(false);
  const [generationActive, setGenerationActive] = useState(false);
  const [completedItemIds, setCompletedItemIds] = useState<string[]>([]); // ads that finished with no errors → hidden
  const [retryGenActive, setRetryGenActive] = useState(false);
  const [retryGenProgress, setRetryGenProgress] = useState(0);
  const retryGenTimerRef = useRef<any>(null);
  const [retryingItemId, setRetryingItemId] = useState<string | null>(null);
  const [retryItemProgress, setRetryItemProgress] = useState(0);
  const [promptGenProgress, setPromptGenProgress] = useState(0);
  const promptGenTimerRef = useRef<any>(null);
  const applyCreateAdJobResultRef = useRef<(job: any) => void>(() => {});
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageGenProgress, setImageGenProgress] = useState(0);
  const imageGenTimerRef = useRef<any>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoGenProgress, setVideoGenProgress] = useState(0);
  const videoGenTimerRef = useRef<any>(null);
  const videoGenPollRef = useRef<any>(null);
  const videoGenStartRef = useRef<number | null>(null);
  const videoGeneratingRef = useRef(false);
  const generationActiveRef = useRef(false);
  const imageGeneratingRef = useRef(false);
  const generationHandledRef = useRef(false);
  const [promptsAccepted, setPromptsAccepted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("app_prompts_accepted") === "true";
    }
    return false;
  });
  const [selectedMetaCampaign, setSelectedMetaCampaign] = useLocalStorage("app_selected_meta_campaign", null);
  const [launchAdCandidate, setLaunchAdCandidate] = useLocalStorage("app_launch_ad_candidate", null);
  const [variantAutomationId, setVariantAutomationId] = useState<string | null>(null);
  const [variantAds, setVariantAds] = useState<any[]>([]);
  const [automationParams, setAutomationParams] = useState<{
    numVariants: number;
    evalLengthDays: number;
    dailyBudgetCents: number;
  } | null>(null);
  const [variantGenerationBusy, setVariantGenerationBusy] = useState({
    active: false,
    progress: 0,
    label: "",
  });

  // Custom Media Upload
  const [customUploadLoading, setCustomUploadLoading] = useState(false);
  const [customUploadError, setCustomUploadError] = useState("");

  // Live Campaigns State
  const [liveCampaigns, setLiveCampaigns] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Edit Campaign / Ad Set Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editType, setEditType] = useState(null); // "Campaign" or "AdSet"
  const [editData, setEditData] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Meta Reports State
  const [metaInsights, setMetaInsights] = useState(null);
  const [metaCampaignInsights, setMetaCampaignInsights] = useState([]);
  const [metaReportsLoading, setMetaReportsLoading] = useState(false);
  const [metaReportsError, setMetaReportsError] = useState("");
  const [selectedCampaignForReports, setSelectedCampaignForReports] = useState(null);


  function clearCreateTabGenerationState() {
    setAdScenesMap({});
    setAdAudioKeysMap({});
    setAdAudioUrlsMap({});
    setAdStatus("idle");
    setPromptsAccepted(false);
    setFailedPrompts([]);
    setCompletedItemIds([]);
    setGenerationActive(false);
    setImageGenerating(false);
    setImageGenProgress(0);
    clearInterval(imageGenTimerRef.current);
    clearInterval(videoGenPollRef.current);
    clearInterval(videoGenTimerRef.current);
    videoGenStartRef.current = null;
    videoGeneratingRef.current = false;
    generationActiveRef.current = false;
    imageGeneratingRef.current = false;
    generationHandledRef.current = false;
    window.localStorage.removeItem("app_video_gen_start");
    window.localStorage.removeItem(IMAGE_GEN_START_KEY);
    window.localStorage.removeItem(CREATE_AD_CLIENT_GEN_KEY);
    setVideoGenerating(false);
    setVideoGenProgress(0);
    setSentIdeaIds({});
    setGeneratedIdeas({});
    setWebhookError("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("app_prompts_accepted");
      localStorage.removeItem("app_ad_status");
      localStorage.removeItem("app_ad_data");
    }
  }

  function markCreateAdClientGenerationActive() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CREATE_AD_CLIENT_GEN_KEY, "1");
  }

  function clearCreateAdClientGenerationMarkers() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(CREATE_AD_CLIENT_GEN_KEY);
    window.localStorage.removeItem(IMAGE_GEN_START_KEY);
    window.localStorage.removeItem(PROMPT_GEN_START_KEY);
  }

  const [activeCreateAdJobId, setActiveCreateAdJobId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(CREATE_AD_JOB_ID_KEY);
  });

  const [activeSocialStudioJobId, setActiveSocialStudioJobId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SOCIAL_STUDIO_JOB_ID_KEY);
  });
  const [socialStudioJobStatus, setSocialStudioJobStatus] = useState("");
  const [socialStudioJobKind, setSocialStudioJobKind] = useState<"image" | "video" | null>(null);
  const [socialStudioGenProgress, setSocialStudioGenProgress] = useState(0);
  const socialStudioGenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function applyCreateTabDefaultsFromAnalysis() {
    if (!analysisData) return;
    setCreateTabAdsConfig((prev) => buildCreateTabConfigFromAnalysis(analysisData, prev));
  }

  function openCreateAdConfigFromAnalysis() {
    applyCreateTabDefaultsFromAnalysis();
    setCreateTabConfigOpen(true);
  }

  // Prefill Create Ad config when analysis completes or user loads a different report
  useEffect(() => {
    if (analysisStatus !== "done" || !analysisData) return;

    const dataId = analysisData.id ?? analysisData.topic ?? "current";
    if (createTabAnalysisSyncIdRef.current === dataId) return;

    const generationBusy =
      generationActive || adStatus === "generating" || adStatus === "waiting";
    if (generationBusy) return;

    createTabAnalysisSyncIdRef.current = dataId;
    clearCreateTabGenerationState();
    setCreateTabAdsConfig((prev) => buildCreateTabConfigFromAnalysis(analysisData, prev));
  }, [
    analysisStatus,
    analysisData,
    generationActive,
    adStatus,
  ]);

  function resetCreateTabWorkspace() {
    clearCreateTabGenerationState();
    setCreateTabAdsConfig({
      totalAds: 1,
      videoCount: 1,
      imageCount: 0,
      items: [
        { id: Date.now(), type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", language: "English", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5", adParams: emptyCreateAdParams() }
      ]
    });
  }

  function closeCreateTabConfig() {
    setCreateTabConfigOpen(false);
  }

  const addSbToast = useCallback((message, type = "success") => {
    const id = crypto.randomUUID();
    setSbToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setSbToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const applyAnalysisReportFromRow = useCallback((row, { toast = true, switchToAnalysisView = true } = {}) => {
    const parsed = parseSbReport(row);
    freshAnalysisResultRef.current = true;
    expandTopicCollapseResults();
    setAnalysisData({ ...parsed, id: row.id });
    setAnalysisStatus("done");
    setAnalysisProgress(100);
    window.localStorage.removeItem("app_analysis_start");
    sessionStorage.removeItem("app_analysis_active");
    setPendingAnalysisTopic(null);
    if (switchToAnalysisView) setAdsLabView("analysis");
    if (toast) addSbToast("Analysis complete!", "success");
  }, [expandTopicCollapseResults, addSbToast]);

  const fetchReports = useCallback(async () => {
    if (!companyId) {
      setSbRows([]);
      setSbLoading(false);
      return;
    }

    setSbLoading(true);
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      companySlugRef.current = data.companySlug ?? null;
      setSbRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      addSbToast("Failed to fetch reports", "error");
    } finally {
      setSbLoading(false);
    }
  }, [companyId, addSbToast]);

  const fetchBrandSnapshots = useCallback(async () => {
    setLoadingBrandSnapshots(true);
    try {
      const res = await fetch("/api/brand-config/snapshots");
      if (!res.ok) throw new Error("Failed to load saved templates");
      const data = await res.json();
      setBrandSnapshots(Array.isArray(data) ? data : []);
    } catch {
      addSbToast("Could not load saved brand templates", "error");
    } finally {
      setLoadingBrandSnapshots(false);
      setBrandSnapshotsLoaded(true);
    }
  }, [addSbToast]);

  useEffect(() => {
    setBrandSnapshotsLoaded(false);
    setBrandSnapshots([]);
  }, [companyId]);

  const getBrandConfigForAnalysis = useCallback(() => {
    if (activeBrandSnapshot?.id && activeBrandSnapshot.id !== "current" && activeBrandSnapshot.data) {
      return profileToDb(activeBrandSnapshot.data);
    }
    return profileToDb(profileData);
  }, [activeBrandSnapshot, profileData]);

  const closeBrandSnapshotsModalDelayed = useCallback(() => {
    setTimeout(() => setBrandSnapshotsModalOpen(false), 200);
  }, []);

  const handleDeleteBrandSnapshot = useCallback(async (snapshot: any) => {
    const label = snapshot.label || "Unnamed template";
    if (activeBrandSnapshot?.id === snapshot.id) {
      addSbToast("Switch to another template before deleting the active one", "error");
      return;
    }
    if (!confirm(`Delete template "${label}"? This cannot be undone.`)) return;

    setDeletingSnapshotId(snapshot.id);
    try {
      const res = await fetch(`/api/brand-config/snapshots/${snapshot.id}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        addSbToast(result.error || "Failed to delete template", "error");
        return;
      }

      if (expandedBrandSnapshotId === snapshot.id) {
        setExpandedBrandSnapshotId(null);
      }
      setBrandSnapshots((prev) => prev.filter((s) => s.id !== snapshot.id));
      addSbToast(`Template "${label}" deleted`, "success");
    } catch {
      addSbToast("Failed to delete template", "error");
    } finally {
      setDeletingSnapshotId(null);
    }
  }, [activeBrandSnapshot?.id, expandedBrandSnapshotId, setActiveBrandSnapshot, addSbToast]);

  const applyBrandSnapshotForAnalysis = useCallback((snapshot: any) => {
    const data = snapshotToProfile(snapshot);
    setActiveBrandSnapshot({
      id: snapshot.id,
      label: snapshot.label || "Saved template",
      created_at: snapshot.created_at,
      data,
    });
    addSbToast("Template selected for Competitors", "success");
    closeBrandSnapshotsModalDelayed();
  }, [setActiveBrandSnapshot, addSbToast, closeBrandSnapshotsModalDelayed]);

  const handleConfirmTemplateName = async () => {
    const name = templateNameInput.trim();
    if (!name) {
      addSbToast("Please enter a template name", "error");
      return;
    }
    if (!pendingSnapshotPayload) return;

    setIsSavingTemplateName(true);
    try {
      const res = await fetch("/api/brand-config/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pendingSnapshotPayload, label: name }),
      });
      const result = await res.json().catch(() => ({}));

      if (res.status === 409 || result.duplicate) {
        addSbToast("This brand data already has a saved template", "error");
        setTemplateNameModalOpen(false);
        setPendingSnapshotPayload(null);
        setTemplateNameInput("");
        return;
      }

      if (!res.ok) {
        addSbToast(result.error || "Failed to save template", "error");
        return;
      }

      if (result.snapshot) {
        const data = snapshotToProfile(result.snapshot);
        const destinationUrl = profileData.destinationUrl || "";
        if (destinationUrl) {
          await fetch("/api/brand-config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ destination_url: destinationUrl }),
          });
        }
        setActiveBrandSnapshot({
          id: result.snapshot.id,
          label: result.snapshot.label || name,
          created_at: result.snapshot.created_at,
          data,
        });
        setProfileData({ ...DEFAULT_BRAND_CONFIG, ...data, destinationUrl });
        fetchBrandSnapshots();
        setIsEditingProfile(false);
        addSbToast(`Template "${name}" saved and selected for Competitors`, "success");
      }

      setTemplateNameModalOpen(false);
      setPendingSnapshotPayload(null);
      setTemplateNameInput("");
    } catch {
      addSbToast("Failed to save template", "error");
    } finally {
      setIsSavingTemplateName(false);
    }
  };

  const handleCancelTemplateName = () => {
    setTemplateNameModalOpen(false);
    setPendingSnapshotPayload(null);
    setTemplateNameInput("");
  };

  useEffect(() => {
    if (companyId) fetchBrandSnapshots();
  }, [companyId, fetchBrandSnapshots]);

  // Restore full template data when only id/label persisted in localStorage;
  // clear stale references from another company or deleted templates.
  // When nothing is selected (new session), default to the latest saved template.
  useEffect(() => {
    if (!companyId || loadingBrandSnapshots || !brandSnapshotsLoaded) return;

    if (activeBrandSnapshot?.id && activeBrandSnapshot.id !== "current") {
      const snapshot = brandSnapshots.find((s: any) => s.id === activeBrandSnapshot.id);
      if (!snapshot) {
        setActiveBrandSnapshot(null);
        return;
      }

      const freshData = snapshotToProfile(snapshot);
      const cachedPayload = activeBrandSnapshot.data
        ? profileToDb({ ...DEFAULT_BRAND_CONFIG, ...activeBrandSnapshot.data })
        : null;
      const freshPayload = profileToDb(freshData);
      if (cachedPayload && JSON.stringify(cachedPayload) === JSON.stringify(freshPayload)) {
        return;
      }

      setActiveBrandSnapshot({
        ...activeBrandSnapshot,
        label: snapshot.label || activeBrandSnapshot.label,
        created_at: snapshot.created_at,
        data: freshData,
      });
      return;
    }

    if (brandSnapshots.length > 0) {
      const latest = brandSnapshots[0];
      setActiveBrandSnapshot({
        id: latest.id,
        label: latest.label || "Saved template",
        created_at: latest.created_at,
        data: snapshotToProfile(latest),
      });
    }
  }, [activeBrandSnapshot, brandSnapshots, brandSnapshotsLoaded, loadingBrandSnapshots, companyId, setActiveBrandSnapshot]);

  const isActiveSavedTemplate =
    Boolean(activeBrandSnapshot?.id && activeBrandSnapshot.id !== "current" && activeBrandSnapshot.data);

  const activeBrandContextLabel = useMemo(() => {
    if (!activeBrandSnapshotHydrated) return null;
    if (activeBrandSnapshot?.id && activeBrandSnapshot.id !== "current") {
      return activeBrandSnapshot.label || "Saved template";
    }
    if (!brandSnapshotsLoaded || loadingBrandSnapshots) return null;
    if (brandSnapshots.length > 0) {
      return brandSnapshots[0].label || "Saved template";
    }
    return "Current brand (live)";
  }, [
    activeBrandSnapshotHydrated,
    activeBrandSnapshot?.id,
    activeBrandSnapshot?.label,
    brandSnapshotsLoaded,
    loadingBrandSnapshots,
    brandSnapshots,
  ]);

  const canRenameActiveTemplateLabel = isActiveSavedTemplate;

  const handleStartEditingActiveTemplateLabel = useCallback(() => {
    if (!canRenameActiveTemplateLabel) return;
    setActiveTemplateLabelDraft(activeBrandSnapshot.label || activeBrandContextLabel || "");
    setIsEditingActiveTemplateLabel(true);
  }, [canRenameActiveTemplateLabel, activeBrandSnapshot?.label, activeBrandContextLabel]);

  const handleCancelEditingActiveTemplateLabel = useCallback(() => {
    setIsEditingActiveTemplateLabel(false);
    setActiveTemplateLabelDraft("");
  }, []);

  const handleSaveActiveTemplateLabel = useCallback(async () => {
    const name = activeTemplateLabelDraft.trim();
    if (!name || !canRenameActiveTemplateLabel || !activeBrandSnapshot?.id) {
      addSbToast("Please enter a template name", "error");
      return;
    }
    setIsSavingActiveTemplateLabel(true);
    try {
      const res = await fetch(`/api/brand-config/snapshots/${activeBrandSnapshot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: name }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        addSbToast(result.error || "Could not rename template", "error");
        return;
      }
      const newLabel = result.snapshot?.label || name;
      setActiveBrandSnapshot({ ...activeBrandSnapshot, label: newLabel });
      setBrandSnapshots((prev) =>
        prev.map((s: any) => (s.id === activeBrandSnapshot.id ? { ...s, label: newLabel } : s))
      );
      setIsEditingActiveTemplateLabel(false);
      setActiveTemplateLabelDraft("");
      addSbToast("Template name updated", "success");
    } catch {
      addSbToast("Could not rename template", "error");
    } finally {
      setIsSavingActiveTemplateLabel(false);
    }
  }, [
    activeTemplateLabelDraft,
    canRenameActiveTemplateLabel,
    activeBrandSnapshot,
    setActiveBrandSnapshot,
    addSbToast,
  ]);

  useEffect(() => {
    setIsEditingActiveTemplateLabel(false);
    setActiveTemplateLabelDraft("");
  }, [activeBrandSnapshot?.id]);

  const displayProfileData = useMemo(() => {
    let base;
    if (isEditingProfile) {
      base = profileData;
    } else if (isActiveSavedTemplate) {
      base = { ...DEFAULT_BRAND_CONFIG, ...activeBrandSnapshot.data };
    } else {
      base = profileData;
    }

    const merged = { ...base };
    for (const { key } of BRAND_ICP_FIELDS) {
      if (!merged[key]?.trim() && profileData[key]?.trim()) {
        merged[key] = profileData[key];
      }
    }
    // Destination URL lives on live company config, not saved templates.
    merged.destinationUrl = profileData.destinationUrl || "";
    return merged;
  }, [isEditingProfile, isActiveSavedTemplate, activeBrandSnapshot?.data, profileData]);

  const visibleIcpFields = useMemo(() => {
    if (!moduleAccessLoaded) return [];
    return filterBrandIcpFieldsByEnabledModules(BRAND_ICP_FIELDS, enabledModuleIds).map((field) => ({
      ...field,
      ...ICP_FIELD_ICONS[field.key],
    }));
  }, [enabledModuleIds, moduleAccessLoaded]);

  const handleStartEditingProfile = () => {
    if (isActiveSavedTemplate) {
      const liveDestinationUrl = profileData.destinationUrl || "";
      setProfileData({ ...DEFAULT_BRAND_CONFIG, ...activeBrandSnapshot.data, destinationUrl: liveDestinationUrl });
    }
    setIsEditingProfile(true);
  };

  const handleCancelEditingProfile = async () => {
    setIsEditingProfile(false);
    try {
      const res = await fetch("/api/brand-config");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setProfileData({ ...DEFAULT_BRAND_CONFIG, ...profileFromDb(data) });
        }
      }
    } catch {
      // keep current profileData on fetch failure
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const payload = profileToDb(profileData);
    const destinationUrl = profileData.destinationUrl || "";

    try {
      if (isActiveSavedTemplate) {
        const res = await fetch(`/api/brand-config/snapshots/${activeBrandSnapshot.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          addSbToast(result.error || "Error saving template", "error");
          return;
        }

        const liveRes = await fetch("/api/brand-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destination_url: destinationUrl }),
        });
        if (!liveRes.ok) {
          addSbToast("Template saved, but destination URL failed to save", "error");
          return;
        }

        const data = snapshotToProfile(result.snapshot);
        setActiveBrandSnapshot({
          ...activeBrandSnapshot,
          data,
        });
        setProfileData({ ...DEFAULT_BRAND_CONFIG, ...data, destinationUrl });
        fetchBrandSnapshots();
        setIsEditingProfile(false);
        addSbToast(`Template "${activeBrandSnapshot.label || "Saved template"}" saved`, "success");
      } else {
        const res = await fetch("/api/brand-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          addSbToast("Error saving brand", "error");
          return;
        }

        const saved = await res.json().catch(() => null);
        if (saved) {
          setProfileData({ ...DEFAULT_BRAND_CONFIG, ...profileFromDb(saved) });
        }
        setIsEditingProfile(false);
        addSbToast("Brand saved successfully!", "success");
      }
    } catch {
      addSbToast("Error saving brand", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAsNewTemplate = () => {
    setPendingSnapshotPayload(profileToDb(profileData));
    setTemplateNameInput("");
    setTemplateNameModalOpen(true);
  };

  const fetchAdTableLinks = useCallback(async () => {
    setAdVideosLoading(true);

    // Fetch via server API (service role) — anon key cannot read your_name_table or list storage
    let dbData = [];
    const storageLookup = new Map();
    const automationExcludedFilenames = new Set<string>();
    try {
      const res = await fetch("/api/ads");
      const payload = await res.json();
      if (!res.ok || payload.error) {
        console.error("Database fetch error:", payload.error || res.statusText);
      } else {
        dbData = payload.rows || [];
        (payload.automationExcludedFilenames || []).forEach((name: string) => {
          if (name) automationExcludedFilenames.add(name);
        });
        Object.entries(payload.storageLookup || {}).forEach(([name, info]) => {
          storageLookup.set(name, info);
        });
      }
    } catch (e) {
      console.warn("Ads fetch failed:", e);
    }

    const latest = {};
    const approvedList = [];
    const allAdsList = [];
    const validPending = [];
    const hasStorageIndex = storageLookup.size > 0;
    const staleMediaKeys = new Set<string>();


    // Process DB data
    (dbData || []).forEach(row => {
      const normalizedText = normalizeSupabaseUrl(row.text);
      if (!normalizedText) return;

      const fileName = getStorageFileName(normalizedText);
      const storageInfo = fileName ? storageLookup.get(fileName) : undefined;

      // Skip variant / automated-campaign challengers (reviewed in their own tabs)
      if (fileName && automationExcludedFilenames.has(fileName)) return;

      // Storage list is a partial index — still show the ad using the DB URL when not listed
      if (hasStorageIndex && fileName && !storageInfo) {
        staleMediaKeys.add(`${row.id}_${row.time}`);
      }

      // We prioritize the database record. If storageLookup found it, we use the storage URL.
      const finalUrl = storageInfo ? storageInfo.publicUrl : normalizedText;
      const entry = { ...row, originalText: row.text, text: finalUrl };
      allAdsList.push(entry);

      if (isAdApproved(row.Approved)) {
        approvedList.push(entry);
      } else {
        validPending.push(entry);
        if (!latest[row.id]) {
          latest[row.id] = entry;
        }
      }

    });



    // Filter pending ads to only include the latest batch (within 1 hour of the absolute newest ad overall)
    let batchPending = [...validPending];
    if (dbData && dbData.length > 0) {
      const newestAdOverallTime = new Date(dbData[0].time).getTime();
      const BATCH_WINDOW_MS = 60 * 60 * 1000; // 1 hour
      batchPending = validPending.filter(a => {
        const adTime = new Date(a.time).getTime();
        return (newestAdOverallTime - adTime) <= BATCH_WINDOW_MS;
      });
    }

    // Select top 3 videos and top 2 images for the Create Ad tab
    const topVideos = batchPending.filter(a => (a.format || "").toLowerCase() === "video").slice(0, 3);
    const topImages = batchPending.filter(a => (a.format || "").toLowerCase() !== "video").slice(0, 2);

    setPendingAds([...topVideos, ...topImages]);
    setPendingAdsCount(validPending.length);

    setAdTableLinks(latest);
    setAllApprovedAds(approvedList);
    setAllPreviewAds(allAdsList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    setMissingMediaKeys(staleMediaKeys);

    // Auto-clear stuck progress UI when new ads land in the table (uses /api/ads, not anon Supabase)
    const genStart = videoGenStartRef.current;
    if (
      genStart &&
      !generationHandledRef.current &&
      (videoGeneratingRef.current || generationActiveRef.current || imageGeneratingRef.current)
    ) {
      const threshold = genStart - 5000;
      const hasNewPending = validPending.some(
        (row) => new Date(row.time).getTime() >= threshold
      );
      if (hasNewPending) {
        generationHandledRef.current = true;
        clearInterval(videoGenPollRef.current);
        clearInterval(videoGenTimerRef.current);
        clearInterval(imageGenTimerRef.current);
        window.localStorage.removeItem("app_video_gen_start");
        window.localStorage.removeItem(IMAGE_GEN_START_KEY);
        clearCreateAdClientGenerationMarkers();
        videoGenStartRef.current = null;
        const wasImage = imageGeneratingRef.current;
        videoGeneratingRef.current = false;
        generationActiveRef.current = false;
        imageGeneratingRef.current = false;
        setGenerationActive(false);
        if (wasImage) {
          setImageGenProgress(100);
          addSbToast("✅ Image Generated Successfully! Check Ad Previews below.", "success");
          setTimeout(() => {
            setImageGenerating(false);
            setImageGenProgress(0);
            resetCreateTabWorkspace();
          }, 2000);
        } else {
          setVideoGenProgress(100);
          addSbToast("✅ Ads generated successfully! Check Ad Previews below.", "success");
          setTimeout(() => {
            setVideoGenerating(false);
            setVideoGenProgress(0);
            resetCreateTabWorkspace();
          }, 2000);
        }
      }
    }

    setAdVideosLoading(false);
  }, [addSbToast]);

  function startAdCompletionPolling(genStart: number) {
    videoGenStartRef.current = genStart;
    generationHandledRef.current = false;
    clearInterval(videoGenPollRef.current);
    const maxDuration = imageGeneratingRef.current
      ? Math.max(VIDEO_GEN_DURATION, IMAGE_GEN_DURATION)
      : VIDEO_GEN_DURATION;
    videoGenPollRef.current = setInterval(async () => {
      if (Date.now() - genStart > maxDuration) {
        clearInterval(videoGenPollRef.current);
        setGenerationActive(false);
        generationActiveRef.current = false;
        videoGeneratingRef.current = false;
        imageGeneratingRef.current = false;
        setVideoGenerating(false);
        setImageGenerating(false);
        setVideoGenProgress(0);
        setImageGenProgress(0);
        window.localStorage.removeItem("app_video_gen_start");
        window.localStorage.removeItem(IMAGE_GEN_START_KEY);
        clearCreateAdClientGenerationMarkers();
        videoGenStartRef.current = null;
        return;
      }
      await fetchAdTableLinks();
    }, AD_COMPLETION_POLL_MS);
  }




  const fetchLiveCampaigns = useCallback(async () => {
    setLiveLoading(true);
    setLiveError("");
    try {
      const res = await fetch("/api/meta/live-campaigns");
      const data = await res.json();
      if (res.ok) {
        setLiveCampaigns(data || []);
      } else {
        setLiveError(data.error || "Failed to fetch live campaigns");
      }
    } catch (e) {
      setLiveError("Failed to connect to API");
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const handleUpdateStatus = async (id, type, status, action) => {
    if (action === "delete" && !confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;

    setUpdatingStatusId(id);
    try {
      const res = await fetch("/api/meta/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, action }),
      });
      const data = await res.json();
      if (res.ok) {
        addSbToast(`${type} ${action === "delete" ? "deleted" : "updated"} successfully!`);
        fetchLiveCampaigns(); // Refresh
      } else {
        addSbToast(data.error || `Failed to update ${type}`, "error");
      }
    } catch (e) {
      addSbToast("Network error", "error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleEditCampaign = async (campaignId) => {
    setEditModalOpen(true);
    setEditType("Campaign");
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/meta/campaign-details?campaignId=${campaignId}`);
      const data = await res.json();
      if (res.ok) {
        setEditData(data.campaign);
      } else {
        setEditError(data.error || "Failed to fetch details");
      }
    } catch (e) {
      setEditError("Network error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditAdSet = async (campaignId, adSetId) => {
    setEditModalOpen(true);
    setEditType("AdSet");
    setEditLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/meta/campaign-details?campaignId=${campaignId}`);
      const data = await res.json();
      if (res.ok) {
        const adSet = data.adSets?.find(a => a.id === adSetId);
        if (adSet) {
          setEditData(adSet);
        } else setEditError("Ad Set not found");
      } else {
        setEditError(data.error || "Failed to fetch details");
      }
    } catch (e) {
      setEditError("Network error");
    } finally {
      setEditLoading(false);
    }
  };

  const updateTargeting = (key, value) => {
    if (!editData) return;
    let t = editData.targeting;
    if (typeof t === 'string') {
      try { t = JSON.parse(t); } catch (e) { t = {}; }
    } else {
      t = { ...t };
    }

    if (key === 'age_min') t.age_min = parseInt(value, 10) || 18;
    if (key === 'age_max') t.age_max = parseInt(value, 10) || 65;
    if (key === 'gender') {
      if (value === '0') {
        delete t.genders;
      } else {
        t.genders = [parseInt(value, 10)];
      }
    }
    if (key === 'countries') {
      if (!t.geo_locations) t.geo_locations = {};
      t.geo_locations.countries = value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    }

    setEditData({ ...editData, targeting: t });
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError("");
    try {
      const payload: any = {};
      if (editType === "Campaign") {
        payload.campaignId = editData.id;
        payload.campaignData = {
          name: editData.name,
        };
      } else if (editType === "AdSet") {
        payload.adSetId = editData.id;
        let parsedTargeting = editData.targeting;
        if (typeof parsedTargeting === 'string') {
          try {
            parsedTargeting = JSON.parse(parsedTargeting);
          } catch (e) {
            setEditError("Invalid JSON in targeting");
            setEditSaving(false);
            return;
          }
        }
        payload.adSetData = {
          name: editData.name,
          daily_budget: parseInt(editData.daily_budget, 10),
          targeting: parsedTargeting
        };
        if (editData.end_time) {
          payload.adSetData.end_time = editData.end_time;
        }
      }

      const res = await fetch("/api/meta/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        addSbToast(`${editType} updated successfully!`);
        setEditModalOpen(false);
        fetchLiveCampaigns();
      } else {
        setEditError(data.error || "Update failed");
      }
    } catch (e) {
      setEditError("Network error");
    } finally {
      setEditSaving(false);
    }
  };

  const fetchMetaInsights = useCallback(async () => {
    setMetaReportsLoading(true);
    setMetaReportsError("");
    try {
      const res = await fetch("/api/meta/reports");
      const data = await res.json();
      if (res.ok) {
        setMetaInsights(data.account || { spend: 0, impressions: 0, reach: 0, linkClicks: 0, inline_link_click_ctr: 0, leads: 0 });
        setMetaCampaignInsights(data.campaigns || []);
      } else {
        setMetaReportsError(data.error || "Failed to fetch Meta insights");
      }
    } catch (e) {
      setMetaReportsError("Failed to connect to reporting API");
    } finally {
      setMetaReportsLoading(false);
    }
  }, []);


  // On mount: if analysisStatus is "generating" but no sessionStorage flag,
  // it means the page was refreshed mid-analysis — reset to idle so user can re-trigger
  // unless another tab still has a recent in-flight run (shared via localStorage).
  useEffect(() => {
    const isActiveSession = sessionStorage.getItem("app_analysis_active");
    const startRaw = window.localStorage.getItem("app_analysis_start");
    const startTime = startRaw ? Number(startRaw) : null;
    const isRecentRun = Boolean(startTime && Date.now() - startTime < 360_000);

    if (!isActiveSession && isRecentRun) {
      setAnalysisStatus("generating");
      sessionStorage.setItem("app_analysis_active", "1");
      return;
    }

    if (!isActiveSession) {
      // No active fetch in this session — clear any stale generating state
      setAnalysisStatus("idle");
      setAnalysisProgress(0);
      window.localStorage.removeItem("app_analysis_start");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!companyId) return;

    fetchReports();
    fetchAdTableLinks();

    // Realtime: refresh tenant-scoped reports when analysis completes
    const channel = supabase
      .channel(`reports_json_realtime_${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports_json" },
        (payload) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (!reportBelongsToCompany(row, companyId, companySlugRef.current)) return;

          if (payload.eventType === "INSERT") {
            addSbToast("New report received!");

            const newReport = parseSbReport(payload.new);
            const pendingTopic = pendingTopicRef.current;
            if (pendingTopic && topicsMatch(newReport.topic, pendingTopic)) {
              applyAnalysisReportFromRow(payload.new);
            }
          }

          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchReports, fetchAdTableLinks, addSbToast, applyAnalysisReportFromRow]);

  // ── Resume progress bar if page was refreshed mid-generation ──
  useEffect(() => {
    const clientGen = window.localStorage.getItem(CREATE_AD_CLIENT_GEN_KEY);
    const videoStored = window.localStorage.getItem("app_video_gen_start");
    const imageStored = window.localStorage.getItem(IMAGE_GEN_START_KEY);
    const promptStored = window.localStorage.getItem(PROMPT_GEN_START_KEY);

    const hasActiveTimer =
      (videoStored && Date.now() - Number(videoStored) < VIDEO_GEN_DURATION) ||
      (imageStored && Date.now() - Number(imageStored) < IMAGE_GEN_DURATION) ||
      (promptStored && Date.now() - Number(promptStored) < PROMPT_GEN_DURATION);

    if (clientGen && !hasActiveTimer) {
      clearCreateAdClientGenerationMarkers();
      window.localStorage.removeItem("app_video_gen_start");
      if (embed && typeof window !== "undefined" && window.parent !== window) {
        window.parent.postMessage(
          { type: CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT, active: false },
          window.location.origin
        );
      }
      return;
    }

    if (clientGen) {
      setCreateTabConfigOpen(true);
      setGenerationActive(true);
      generationActiveRef.current = true;
    }

    if (promptStored && clientGen) {
      const promptStart = Number(promptStored);
      const elapsed = Date.now() - promptStart;
      if (elapsed < PROMPT_GEN_DURATION) {
        setAdStatus("generating");
        setPromptGenProgress(Math.min(99, Math.round((elapsed / PROMPT_GEN_DURATION) * 100)));
        clearInterval(promptGenTimerRef.current);
        promptGenTimerRef.current = setInterval(() => {
          const pct = Math.min(99, ((Date.now() - promptStart) / PROMPT_GEN_DURATION) * 100);
          setPromptGenProgress(Math.round(pct));
          if (Date.now() - promptStart >= PROMPT_GEN_DURATION) {
            clearInterval(promptGenTimerRef.current);
          }
        }, 2000);
      } else {
        window.localStorage.removeItem(PROMPT_GEN_START_KEY);
      }
    }

    if (imageStored) {
      const start = Number(imageStored);
      const elapsed = Date.now() - start;
      if (elapsed < IMAGE_GEN_DURATION) {
        videoGenStartRef.current = start;
        imageGeneratingRef.current = true;
        setImageGenerating(true);
        setImageGenProgress(Math.min(99, Math.round((elapsed / IMAGE_GEN_DURATION) * 100)));
        clearInterval(imageGenTimerRef.current);
        imageGenTimerRef.current = setInterval(() => {
          const e2 = Date.now() - start;
          setImageGenProgress(Math.min(99, Math.round((e2 / IMAGE_GEN_DURATION) * 100)));
          if (e2 >= IMAGE_GEN_DURATION) clearInterval(imageGenTimerRef.current);
        }, 2000);
        startAdCompletionPolling(start);
        return;
      }
      window.localStorage.removeItem(IMAGE_GEN_START_KEY);
    }

    if (!videoStored) return;
    const start = Number(videoStored);
    const elapsed = Date.now() - start;
    if (elapsed < VIDEO_GEN_DURATION) {
      videoGenStartRef.current = start;
      videoGeneratingRef.current = true;
      generationActiveRef.current = true;
      setVideoGenerating(true);
      setGenerationActive(true);
      setVideoGenProgress(Math.min(99, Math.round((elapsed / VIDEO_GEN_DURATION) * 100)));
      clearInterval(videoGenTimerRef.current);
      videoGenTimerRef.current = setInterval(() => {
        const e2 = Date.now() - start;
        setVideoGenProgress(Math.min(99, Math.round((e2 / VIDEO_GEN_DURATION) * 100)));
        if (e2 >= VIDEO_GEN_DURATION) clearInterval(videoGenTimerRef.current);
      }, 2000);
      startAdCompletionPolling(start);
    } else {
      window.localStorage.removeItem("app_video_gen_start");
      if (!clientGen) clearCreateAdClientGenerationMarkers();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createAdGenerationBusy =
    !!activeCreateAdJobId ||
    adStatus === "generating" ||
    adStatus === "waiting" ||
    generationActive ||
    videoGenerating ||
    imageGenerating ||
    isStatusPolling;

  const socialStudioGenerationBusy = !!activeSocialStudioJobId;

  const [adsLibraryScrapeBusy, setAdsLibraryScrapeBusy] = useState(false);

  useEffect(() => {
    const onScrape = (e: Event) => {
      const active = Boolean((e as CustomEvent<{ active?: boolean }>).detail?.active);
      setAdsLibraryScrapeBusy(active);
    };
    window.addEventListener(ADS_LIBRARY_SCRAPE_EVENT, onScrape);
    return () => window.removeEventListener(ADS_LIBRARY_SCRAPE_EVENT, onScrape);
  }, []);

  const metaAdsPipelineBusy =
    createAdGenerationBusy || variantGenerationBusy.active || socialStudioGenerationBusy;

  const shellKeepAliveBusy = metaAdsPipelineBusy || adsLibraryScrapeBusy;

  // Keep polling ad previews while Create Ad generation runs (any app tab)
  useEffect(() => {
    const busy =
      metaAdsPipelineBusy;
    if (!busy || !companyId) return;

    const interval = setInterval(() => {
      fetchAdTableLinks();
    }, AD_COMPLETION_POLL_MS);
    return () => clearInterval(interval);
  }, [
    metaAdsPipelineBusy,
    companyId,
    fetchAdTableLinks,
  ]);

  // Tell client-dashboard shell to keep the main-app iframe alive while Meta Ads pipelines run
  // (includes Ads Library scrapes so Dashboard / Configuration / Settings / Profile don't tear it down)
  useEffect(() => {
    if (!embed || typeof window === "undefined" || window.parent === window) return;
    const busy = shellKeepAliveBusy;
    window.parent.postMessage(
      { type: CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT, active: busy },
      window.location.origin
    );
  }, [
    embed,
    shellKeepAliveBusy,
  ]);

  // Resume in-flight server Create Ad job (reload / return from another module)
  useEffect(() => {
    if (!companyId || activeCreateAdJobId) return;
    let cancelled = false;
    fetch(`${CREATE_AD_JOBS_API}?active=1`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.job?.id) return;
        window.localStorage.setItem(CREATE_AD_JOB_ID_KEY, d.job.id);
        setActiveCreateAdJobId(d.job.id);
        markCreateAdClientGenerationActive();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId, activeCreateAdJobId]);

  // Poll background Create Ad job until completed or failed
  useEffect(() => {
    if (!companyId || !activeCreateAdJobId) return;

    let cancelled = false;

    const syncRunningJobUi = (job: any) => {
      if (job.status !== "pending" && job.status !== "running") return;
      markCreateAdClientGenerationActive();
      if (job.kind === "prompts") {
        setAdStatus("generating");
        setCreateTabConfigOpen(true);
        const promptStartRaw = window.localStorage.getItem(PROMPT_GEN_START_KEY);
        if (!promptStartRaw) {
          const promptStart = Date.now();
          window.localStorage.setItem(PROMPT_GEN_START_KEY, String(promptStart));
          setPromptGenProgress(0);
          clearInterval(promptGenTimerRef.current);
          promptGenTimerRef.current = setInterval(() => {
            const pct = Math.min(99, ((Date.now() - promptStart) / PROMPT_GEN_DURATION) * 100);
            setPromptGenProgress(Math.round(pct));
            if (Date.now() - promptStart >= PROMPT_GEN_DURATION) clearInterval(promptGenTimerRef.current);
          }, 2000);
        }
      } else if (job.kind === "video") {
        setGenerationActive(true);
        generationActiveRef.current = true;
        if (!videoGenStartRef.current && !window.localStorage.getItem("app_video_gen_start")) {
          startVideoGenProgress();
        } else {
          setVideoGenerating(true);
        }
      } else if (job.kind === "image") {
        setImageGenerating(true);
        imageGeneratingRef.current = true;
        setCreateTabConfigOpen(true);
      }
    };

    const poll = async () => {
      try {
        const res = await fetch(
          `${CREATE_AD_JOBS_API}?jobId=${encodeURIComponent(activeCreateAdJobId)}`
        );
        const data = await res.json();
        if (cancelled || !res.ok || !data.job) return;
        const job = data.job;
        if (job.status === "pending" || job.status === "running") {
          syncRunningJobUi(job);
          return;
        }
        applyCreateAdJobResultRef.current(job);
      } catch (e) {
        console.warn("[create-ad job poll]", e);
      }
    };

    void poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [companyId, activeCreateAdJobId]);

  // Creator Studio background job — poll on any tab (SocialDash unmounts when you leave)
  useEffect(() => {
    const onJobEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ jobId: string | null }>).detail;
      setActiveSocialStudioJobId(detail?.jobId ?? null);
    };
    window.addEventListener(SOCIAL_STUDIO_JOB_EVENT, onJobEvent);
    return () => window.removeEventListener(SOCIAL_STUDIO_JOB_EVENT, onJobEvent);
  }, []);

  useEffect(() => {
    const id = window.localStorage.getItem(SOCIAL_STUDIO_JOB_ID_KEY);
    if (id && id !== activeSocialStudioJobId) setActiveSocialStudioJobId(id);
  }, [tab, activeSocialStudioJobId]);

  useEffect(() => {
    if (activeSocialStudioJobId || !companyId) return;
    let cancelled = false;
    fetchActiveSocialStudioBackgroundJob()
      .then((job) => {
        if (cancelled || !job?.id) return;
        window.localStorage.setItem(SOCIAL_STUDIO_JOB_ID_KEY, job.id);
        setActiveSocialStudioJobId(job.id);
        setSocialStudioJobStatus(job.status || "");
        const kindRaw = window.localStorage.getItem(SOCIAL_STUDIO_GEN_KIND_KEY);
        setSocialStudioJobKind(
          kindRaw === "video" ? "video" : job.kind === "video" ? "video" : "image"
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId, activeSocialStudioJobId]);

  useEffect(() => {
    if (!companyId || !activeSocialStudioJobId) return;
    let cancelled = false;

    const finish = (job: any) => {
      window.localStorage.removeItem(SOCIAL_STUDIO_JOB_ID_KEY);
      window.localStorage.removeItem(SOCIAL_STUDIO_GEN_START_KEY);
      window.localStorage.removeItem(SOCIAL_STUDIO_GEN_KIND_KEY);
      setActiveSocialStudioJobId(null);
      setSocialStudioJobStatus("");
      setSocialStudioJobKind(null);
      setSocialStudioGenProgress(0);
      if (socialStudioGenTimerRef.current) {
        clearInterval(socialStudioGenTimerRef.current);
        socialStudioGenTimerRef.current = null;
      }
      const runStatus = getJobBackgroundRunStatus(job);
      if (runStatus === "failed" || job.error) {
        addSbToast(job.error || "Creator Studio generation failed", "error");
        return;
      }
      addSbToast(
        job.kind === "image"
          ? "Social image ready — open Creator Studio to review"
          : "Social video ready — open Creator Studio to review",
        "success"
      );
    };

    const poll = async () => {
      try {
        const job = await fetchSocialStudioBackgroundJob(activeSocialStudioJobId);
        if (cancelled || !job) return;
        setSocialStudioJobStatus(job.status || "");
        const kindStored = window.localStorage.getItem(SOCIAL_STUDIO_GEN_KIND_KEY);
        setSocialStudioJobKind(
          kindStored === "video" ? "video" : job.kind === "video" ? "video" : "image"
        );
        const runStatus = getJobBackgroundRunStatus(job);
        if (runStatus === "pending" || runStatus === "running") return;
        if (isSocialStudioBackgroundJobDone(job)) finish(job);
      } catch (e) {
        console.warn("[social-studio job poll]", e);
      }
    };

    void poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [companyId, activeSocialStudioJobId, addSbToast]);

  useEffect(() => {
    if (!activeSocialStudioJobId) {
      if (socialStudioGenTimerRef.current) {
        clearInterval(socialStudioGenTimerRef.current);
        socialStudioGenTimerRef.current = null;
      }
      return;
    }

    let startRaw = window.localStorage.getItem(SOCIAL_STUDIO_GEN_START_KEY);
    if (!startRaw) {
      startRaw = String(Date.now());
      window.localStorage.setItem(SOCIAL_STUDIO_GEN_START_KEY, startRaw);
    }
    const kindRaw = window.localStorage.getItem(SOCIAL_STUDIO_GEN_KIND_KEY);
    const duration =
      kindRaw === "video" ? SOCIAL_STUDIO_VIDEO_GEN_DURATION : SOCIAL_STUDIO_IMAGE_GEN_DURATION;
    const start = Number(startRaw);

    const tick = () => {
      const elapsed = Date.now() - start;
      setSocialStudioGenProgress(Math.min(99, Math.round((elapsed / duration) * 100)));
    };
    tick();
    socialStudioGenTimerRef.current = setInterval(tick, 2000);
    return () => {
      if (socialStudioGenTimerRef.current) {
        clearInterval(socialStudioGenTimerRef.current);
        socialStudioGenTimerRef.current = null;
      }
    };
  }, [activeSocialStudioJobId]);

  useEffect(() => {
    if (tab !== "create" || !companyId) return;
    void fetchAdTableLinks();
  }, [tab, companyId, fetchAdTableLinks]);

  // ── Supabase realtime: detect new videos ──
  useEffect(() => {
    const adsChannel = supabase
      .channel("your_name_table_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "your_name_table" }, async () => {
        if (!videoGeneratingRef.current && !generationActiveRef.current && !imageGeneratingRef.current) return;
        await fetchAdTableLinks();
      })
      .subscribe();
    return () => { supabase.removeChannel(adsChannel); };
  }, [fetchAdTableLinks]);

  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (sessionStatus === "authenticated" && session?.user?.email) {
      setUser({ email: session.user.email });
      setIsAuthenticating(false);
      return;
    }

    const callbackUrl = embed ? "/client-login" : "/client-login";
    router.push(callbackUrl);
  }, [router, session, sessionStatus, embed]);

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: "/client-login" });
      addSbToast("Signed out successfully");
    } catch (e) {
      console.error("Logout error:", e);
      addSbToast("Failed to sign out", "error");
    }
  };

  useEffect(() => {
    if (tab === "live_campaigns") {
      fetchLiveCampaigns();
    }
    if (tab === "reports" || tab === "overview") {
      fetchMetaInsights();
    }
  }, [tab, fetchLiveCampaigns, fetchMetaInsights]);

  // ── Polling workflow status from Supabase status_table (tenant-scoped) ──
  useEffect(() => {
    let interval;
    if (isStatusPolling || adStatus === "waiting") {
      interval = setInterval(async () => {
        let query = supabase.from("status_table").select("status");
        if (companyId) {
          query = query.eq("company_id", companyId);
        } else {
          query = query.eq("id", 1);
        }
        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("Status polling error:", error);
          return;
        }

        if (data) {
          const newStatus = data.status || "";
          setWorkflowStatus(newStatus);

          // Refresh if any part of the workflow completed or if overall completion reached
          const isIntermediateDone = newStatus.toLowerCase().includes("completed") && !workflowStatus?.toLowerCase().includes("completed");
          const isFullyDone = newStatus.toLowerCase().includes("completed");

          if (isIntermediateDone || isFullyDone) {
            fetchAdTableLinks(); // Refresh the grid
          }

          if (isFullyDone) {
            setIsStatusPolling(false);
            setAdStatus("idle");
            generationActiveRef.current = false;
            videoGeneratingRef.current = false;
            setGenerationActive(false);
            clearInterval(videoGenPollRef.current);
            clearInterval(videoGenTimerRef.current);
            window.localStorage.removeItem("app_video_gen_start");
            window.localStorage.removeItem(IMAGE_GEN_START_KEY);
            clearCreateAdClientGenerationMarkers();
            videoGenStartRef.current = null;
            setVideoGenerating(false);
            setVideoGenProgress(0);
            addSbToast("Ads Generation Completed! Your ad creatives are being processed. Check the Ad Previews section below.", "success");
          }
        }
      }, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isStatusPolling, adStatus, fetchAdTableLinks, addSbToast, companyId]);

  // ── Analysis progress bar: phase-aligned estimates for direct API pipeline ──
  useEffect(() => {
    if (analysisStatus !== "generating") {
      setAnalysisProgress(analysisStatus === "done" ? 100 : 0);
      if (analysisStatus !== "done") {
        setAnalysisPhaseIndex(0);
        setAnalysisStatusMessage(ANALYSIS_PIPELINE_PHASES[0].status);
      }
      return;
    }

    const startRaw = window.localStorage.getItem("app_analysis_start");
    const startTime = startRaw ? Number(startRaw) : null;

    // Auto-reset if start time is missing or > 6 min old (stale from previous session)
    if (!startTime || (Date.now() - startTime) > 360_000) {
      setAnalysisStatus("idle");
      setAnalysisProgress(0);
      setAnalysisPhaseIndex(0);
      setAnalysisStatusMessage(ANALYSIS_PIPELINE_PHASES[0].status);
      window.localStorage.removeItem("app_analysis_start");
      return;
    }

    const tick = () => {
      const { progress, phaseIndex, status } = getAnalysisProgressFromElapsed(Date.now() - startTime);
      setAnalysisProgress(progress);
      setAnalysisPhaseIndex(phaseIndex);
      setAnalysisStatusMessage(status);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [analysisStatus]);

  // Poll for analysis completion while generating — works even when user is on another tab
  useEffect(() => {
    if (analysisStatus !== "generating") return;

    const poll = setInterval(async () => {
      const pendingTopic = pendingTopicRef.current || pendingAnalysisTopic;
      if (!pendingTopic) return;

      const startRaw = window.localStorage.getItem("app_analysis_start");
      const startTime = startRaw ? Number(startRaw) : null;

      let match = findMatchingAnalysisReport(sbRows, pendingTopic, startTime);
      if (!match) {
        try {
          const res = await fetch("/api/reports");
          if (!res.ok) return;
          const { rows } = await res.json();
          match = findMatchingAnalysisReport(Array.isArray(rows) ? rows : [], pendingTopic, startTime);
        } catch {}
      }

      if (match) applyAnalysisReportFromRow(match);
    }, 5000);

    const stopTimer = setTimeout(() => clearInterval(poll), 600_000);
    return () => {
      clearInterval(poll);
      clearTimeout(stopTimer);
    };
  }, [analysisStatus, pendingAnalysisTopic, sbRows, applyAnalysisReportFromRow]);

  // When returning to Competitors, sync any completed report and reset section layout
  useEffect(() => {
    if (tab !== "analysis") return;

    if (analysisStatus !== "generating") {
      if (analysisStatus === "done" && analysisData && prevTabRef.current !== "analysis") {
        expandTopicCollapseResults();
      }
      prevTabRef.current = tab;
      return;
    }

    const pendingTopic = pendingTopicRef.current || pendingAnalysisTopic;
    const startRaw = window.localStorage.getItem("app_analysis_start");
    const startTime = startRaw ? Number(startRaw) : null;
    const match = findMatchingAnalysisReport(sbRows, pendingTopic, startTime);
    if (match) {
      applyAnalysisReportFromRow(match, { toast: false });
    }
    prevTabRef.current = tab;
  }, [tab, analysisStatus, analysisData, sbRows, pendingAnalysisTopic, expandTopicCollapseResults, applyAnalysisReportFromRow]);

  const sbReports = sbRows.map((row) => ({ row, report: parseSbReport(row) }));
  const sbTotalReports = sbRows.length;
  const sbTotalCompetitors = sbReports.reduce((s, { report }) => s + (report.competitors_table || []).length, 0);
  const sbHighThreats = sbReports.reduce((s, { report }) => s + (report.competitors_table || []).filter((c) => c.threat === "high").length, 0);
  const sbPendingAds = sbRows.filter((r) => !r.ads_workflow_triggered).length;

  // ── Ads config helpers ──
  const VIDEO_TYPES = ["Reel", "Story", "Feed Post", "Carousel"];
  const DURATIONS = ["20 seconds", "28 seconds", "32 seconds", "36 seconds", "40 seconds"];
  const AUDIO_STYLES = ["Background Music", "Voiceover"];
  const VIDEO_STYLES = ["Bold & Colorful", "Cinematic", "Minimal & Clean", "Dark & Moody", "Neon / Glow", "Hand-drawn / Sketch"];
  const LANGUAGES = ["English", "Spanish", "French", "Hebrew", "Turkish"];
  const VOICE_OPTIONS = {
    male: [
      { label: "Markmont", id: "rTOopItG6FIkKMIVxsl5" },
      { label: "John", id: "lXyLz3Gu0YqdG8RfvIyZ" },
    ],
    female: [
      { label: "Adhalina", id: "i2SoWWnAm3qCyr53Jenw" },
      { label: "Clara", id: "k9KXsQFJqzAoomTCOrJB" },
    ],
  };

  function getAdsConfig(reportId) {
    return sbAdsConfigs[reportId] || { numAds: 1, videos: [{ videoType: "Reel", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", videoIdea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" }] };
  }

  function updateAdsConfig(reportId, updater) {
    setSbAdsConfigs((prev) => {
      const current = prev[reportId] || { numAds: 1, videos: [{ videoType: "Reel", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", videoIdea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" }] };
      return { ...prev, [reportId]: updater(current) };
    });
  }

  function setNumAds(reportId, num) {
    updateAdsConfig(reportId, (cfg) => {
      const n = Math.max(1, Math.min(5, num));
      const videos = [...cfg.videos];
      while (videos.length < n) videos.push({ videoType: "Reel", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", videoIdea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" });
      return { ...cfg, numAds: n, videos: videos.slice(0, n) };
    });
  }

  function updateVideoConfig(reportId, idx, field, value) {
    updateAdsConfig(reportId, (cfg) => {
      const videos = [...cfg.videos];
      videos[idx] = { ...videos[idx], [field]: value };
      return { ...cfg, videos };
    });
  }

  function updateCreateTabTotalAds(num) {
    if (num > 5) {
      addSbToast("Maximum of 5 total ads allowed", "error");
      return;
    }
    const n = Math.max(1, num);
    setCreateTabAdsConfig((prev) => {
      const currentTotal = prev.items.length;
      let newItems = [...prev.items];

      if (n > currentTotal) {
        for (let i = 0; i < n - currentTotal; i++) {
          // Default to video if space allows, else image
          const vCount = newItems.filter(x => x.type === "video").length;
          const type = vCount < 3 ? "video" : "image";

          if (type === "video") {
            newItems.push({ id: Date.now() + i, type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", language: "English", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5", adParams: emptyCreateAdParams() });
          } else {
            // Check if we can add image
            const iCount = newItems.filter(x => x.type === "image").length;
            if (iCount < 2) {
              newItems.push({ id: Date.now() + i, type: "image", imageStyle: "Bold & Colorful", idea: "", adParams: emptyCreateAdParams() });
            } else {
              // If we reach 3V and 2I, we can't add more anyway due to n=5 limit
              break;
            }
          }
        }
      } else {
        newItems = newItems.slice(0, n);
      }

      const vCount = newItems.filter(x => x.type === "video").length;
      const iCount = newItems.filter(x => x.type === "image").length;
      return { totalAds: newItems.length, videoCount: vCount, imageCount: iCount, items: newItems };
    });
  }

  function setCreateTabItemType(idx, type) {
    setCreateTabAdsConfig((prev) => {
      const currentItem = prev.items[idx];
      if (currentItem.type === type) return prev;

      if (type === "video" && prev.videoCount >= 3) {
        addSbToast("Maximum of 3 Videos allowed", "error");
        return prev;
      }
      if (type === "image" && prev.imageCount >= 2) {
        addSbToast("Maximum of 2 Images allowed", "error");
        return prev;
      }

      const itemId = prev.items[idx].id;
      const preservedIdea = currentItem.idea || "";
      const preservedParams = currentItem.adParams || emptyCreateAdParams();
      // Clear generated ideas and pending state for this item on type switch
      setSentIdeaIds(s => { const n = { ...s }; delete n[itemId]; return n; });
      setGeneratedIdeas(g => { const n = { ...g }; delete n[itemId]; return n; });

      const newItems = [...prev.items];
      if (type === "video") {
        newItems[idx] = {
          id: itemId,
          type: "video",
          duration: currentItem.duration || "28 seconds",
          audioStyle: currentItem.audioStyle || "Background Music",
          videoStyle: currentItem.videoStyle || "Bold & Colorful",
          language: currentItem.language || "English",
          idea: preservedIdea,
          character: currentItem.character || "male",
          voiceId: currentItem.voiceId || "rTOopItG6FIkKMIVxsl5",
          adParams: preservedParams,
        };
      } else {
        newItems[idx] = {
          id: itemId,
          type: "image",
          imageStyle: currentItem.imageStyle || "Bold & Colorful",
          idea: normalizeIdeaForAdType(preservedIdea, "image"),
          adParams: preservedParams,
        };
      }
      const vCount = newItems.filter(x => x.type === "video").length;
      const iCount = newItems.filter(x => x.type === "image").length;
      return { ...prev, videoCount: vCount, imageCount: iCount, items: newItems };
    });
  }

  function updateCreateTabItemField(idx, field, value) {
    setCreateTabAdsConfig((prev) => {
      const newItems = [...prev.items];
      newItems[idx] = { ...newItems[idx], [field]: value };
      return { ...prev, items: newItems };
    });
  }

  function updateCreateTabItemAdParam(idx, field, value) {
    setCreateTabAdsConfig((prev) => {
      const newItems = [...prev.items];
      const current = newItems[idx];
      newItems[idx] = {
        ...current,
        adParams: { ...(current.adParams || emptyCreateAdParams()), [field]: value },
      };
      return { ...prev, items: newItems };
    });
  }

  async function handleGenerateCreateAdIdeas(idx, item, isVideo) {
    if (sentIdeaIds[item.id]) return;
    if (!hasCreateAdParams(item.adParams)) {
      addSbToast("Select Prompt Parameters from your competitor analysis first.", "error");
      return;
    }
    if (isVideo && item.audioStyle !== "Background Music" && !voiceLabels[item.id]) {
      addSbToast("Please select a voice first — click the 🎙️ Voices button.", "error");
      return;
    }
    setSentIdeaIds((prev) => ({ ...prev, [item.id]: true }));
    addSbToast(`Generating ${isVideo ? "video" : "image"} ideas from parameters…`);
    try {
      const res = await fetch(CREATE_AD_IDEAS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, brand_config: getBrandConfigForAnalysis() }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        let ideasArr = [];
        if (Array.isArray(data)) {
          if (data[0] && Array.isArray(data[0].ideas)) ideasArr = data[0].ideas;
          else if (data[0] && (data[0].idea || data[0].prompt)) ideasArr = data;
          else if (Array.isArray(data[0])) ideasArr = data[0];
        } else if (data && Array.isArray(data.ideas)) {
          ideasArr = data.ideas;
        }
        ideasArr = (ideasArr || [])
          .map((ideaObj) =>
            typeof ideaObj === "string" ? { idea: ideaObj } : { ...ideaObj, idea: ideaTextFromGenerated(ideaObj) }
          )
          .filter((ideaObj) => ideaObj.idea);
        if (ideasArr.length > 0) {
          setGeneratedIdeas((prev) => ({ ...prev, [item.id]: ideasArr }));
          addSbToast("Ideas generated — click one to use in the prompt.", "success");
        } else {
          console.error("Unrecognized JSON format from ad pipeline:", data);
          addSbToast("No valid ideas format returned.", "error");
        }
      } else {
        addSbToast("Failed to generate ideas", "error");
      }
    } catch {
      addSbToast("Error fetching ideas", "error");
    } finally {
      setSentIdeaIds((prev) => ({ ...prev, [item.id]: false }));
    }
  }


  async function handleApproveAd(row) {
    if (!row) return;
    setApprovingId(row.id + "_" + row.time);

    try {
      const res = await fetch("/api/ads/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: row.originalText || row.text,
          approved: true,
          id: row.id,
          time: row.time,
          format: row.format,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Approval failed");
      }
      if (data.rowsAffected === 0) {
        throw new Error("No matching ad record found to approve");
      }
      setAllPreviewAds((prev) =>
        prev.map((ad) =>
          ad.id === row.id && ad.time === row.time ? { ...ad, Approved: "true" } : ad
        )
      );
      addSbToast("Ad approved successfully!");
      await fetchAdTableLinks();
    } catch (error) {
      console.error("Approval error:", error);
      addSbToast(`Approval failed: ${error.message || "Unknown error"}`, "error");
    }

    setApprovingId(null);
  }

  async function handleUnapproveAd(row) {
    if (!row) return;
    setUnapprovingId(row.id + "_" + row.time);

    try {
      const res = await fetch("/api/ads/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: row.originalText || row.text,
          approved: false,
          id: row.id,
          time: row.time,
          format: row.format,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unapprove failed");
      }
      if (data.rowsAffected === 0) {
        throw new Error("No matching ad record found to unapprove");
      }
      setAllPreviewAds((prev) =>
        prev.map((ad) =>
          ad.id === row.id && ad.time === row.time ? { ...ad, Approved: "false" } : ad
        )
      );
      addSbToast("Ad unapproved.");
      await fetchAdTableLinks();
    } catch (error) {
      console.error("Unapprove error:", error);
      addSbToast(`Unapprove failed: ${error.message || "Unknown error"}`, "error");
    }

    setUnapprovingId(null);
  }

  async function handleRemoveApprovedAd(ad) {
    if (!ad || !confirm("Permanently delete this creative? This cannot be undone.")) return;
    setRemovingId(ad.id + "_" + ad.time);
    try {
      const res = await fetch("/api/ads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ad.id,
          time: ad.time,
          text: ad.originalText || ad.text,
          deleteRow: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Remove failed");
      }
      addSbToast("Creative deleted.");
      await fetchAdTableLinks();
    } catch (error) {
      console.error("Remove error:", error);
      addSbToast(`Remove failed: ${error.message || "Unknown error"}`, "error");
    }
    setRemovingId(null);
  }

  async function handleDeleteStaleAd(ad) {
    if (!ad) return;
    if (!confirm("This media is missing from Supabase storage. Delete the database entry?")) return;
    const adKey = ad.id + "_" + ad.time;
    setRemovingId(adKey);
    try {
      const res = await fetch("/api/ads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ad.id,
          time: ad.time,
          text: ad.originalText || ad.text,
          deleteRow: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Delete failed");
      }
      setMissingMediaKeys((prev) => {
        const next = new Set(prev);
        next.delete(adKey);
        return next;
      });
      addSbToast("Stale ad entry removed.");
      await fetchAdTableLinks();
    } catch (error) {
      console.error("Delete stale ad error:", error);
      addSbToast(`Delete failed: ${error.message || "Unknown error"}`, "error");
    }
    setRemovingId(null);
  }

  async function handleSaveEdits(ad) {
    if (!ad) return;
    setIsSavingAd(true);

    try {
      const oldJson = typeof ad["json data"] === "string" ? JSON.parse(ad["json data"]) : (ad["json data"] || {});
      const oldAd = getAdJsonRecord(oldJson);
      const description = editingAdData.primaryText ?? getAdDescription(oldJson);
      const adName = editingAdData.adName || oldAd.name || oldAd.ad_name || "Untitled Ad";
      const headline = editingAdData.headline || oldAd.headline || "No headline provided.";
      const ctaType = editingAdData.ctaType || oldAd.call_to_action_type || "WATCH_MORE";
      const destinationUrl =
        editingAdData.linkData?.trim() ||
        getAdDestinationUrl(oldJson) ||
        profileData.destinationUrl ||
        DEFAULT_WEBSITE_URL ||
        "";
      const mediaLink = (() => {
        const legacy = String(oldJson.link_data || "").trim();
        if (legacy && isStorageMediaUrl(legacy)) return legacy;
        return ad.text || ad.originalText || legacy || "";
      })();
      const campaignName = editingAdData.campaignName || oldJson.campaign?.name || "Untitled Campaign";

      const updatedJsonData = {
        ...oldJson,
        campaign: {
          ...(oldJson.campaign || {}),
          name: campaignName,
        },
        ad: {
          ...(oldJson.ad || {}),
          id: oldJson.ad?.id || oldJson.ads?.[0]?.id || oldAd.ad_id || Date.now(),
          name: adName,
          ad_name: adName,
          type: oldJson.ad?.type || oldJson.ads?.[0]?.ad_type || oldAd.ad_type || "video",
          headline,
          primary_text: description,
          call_to_action_type: ctaType,
          website_url: destinationUrl,
          destination_url: destinationUrl,
        },
        link_data: mediaLink,
        ad_name: adName,
        headline,
        primary_text: description,
        destination_url: destinationUrl,
      };

      if (Array.isArray(oldJson.ads) && oldJson.ads.length > 0) {
        updatedJsonData.ads = oldJson.ads.map((item, index) =>
          index === 0
            ? {
                ...item,
                ad_name: adName,
                headline,
                primary_text: description,
                destination_url: destinationUrl,
              }
            : item
        );
      }

      const res = await fetch("/api/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ad.id,
          time: ad.time,
          jsonData: updatedJsonData,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Save failed");
      }

      addSbToast("Changes saved successfully!");
      setIsEditingAd(false);
      await fetchAdTableLinks();
    } catch (error) {
      console.error("Save error:", error);
      addSbToast(`Failed to save changes: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    }

    setIsSavingAd(false);
  }




  async function handleRefreshAdVideos() {
    await fetchAdTableLinks();
  }

  async function pollKieTasks(taskIds: string[], maxWaitMs = KIE_POLL_MAX_WAIT_MS) {
    if (!taskIds.length) return [];
    const deadline = Date.now() + maxWaitMs;
    let results: any[] = [];
    let attempt = 0;
    while (Date.now() < deadline) {
      const res = await fetch(CREATE_AD_KIE_POLL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "KIE poll failed");
      results = data.results || [];
      if (data.allComplete) return results;
      const delay = attempt < 2 ? 20_000 : 30_000;
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
    }
    const res = await fetch(CREATE_AD_KIE_POLL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds }),
    });
    const data = await res.json();
    return data.results || results;
  }

  function buildSceneGenerationResponse(scenes: any[], imagePoll: any[], videoPoll: any[]) {
    const results: any[] = [];
    const failedPrompts: any[] = [];
    scenes.forEach((scene, index) => {
      const prompt = scene.prompt_clean || scene.prompt || "";
      if (!scene.image_url) {
        const imgFail = imagePoll[index] || {};
        results.push({ success: false, state: "fail", prompt, taskId: imgFail.taskId || "", index, failMsg: imgFail.failMsg || "Image generation failed" });
        failedPrompts.push({ prompt, reason: imgFail.failMsg || "Image generation failed" });
        return;
      }
      if (!scene.video_url) {
        const vidFail = videoPoll[index] || {};
        results.push({ success: false, state: "fail", prompt, taskId: vidFail.taskId || "", index, failMsg: vidFail.failMsg || "Video generation failed" });
        failedPrompts.push({ prompt, reason: vidFail.failMsg || "Video generation failed" });
        return;
      }
      results.push({ success: true, state: "success", prompt, taskId: scene.task_id || "", index });
    });
    const failCount = results.filter((r) => !r.success).length;
    return { totalCount: results.length, successCount: results.length - failCount, failCount, failedPrompts, results };
  }

  async function runServerVideoGeneration(
    generatedPrompts: Record<string, any[]>,
    audioKeys: Record<string, string> = {},
    audioUrls: Record<string, string> = {}
  ) {
    const res = await fetch(CREATE_AD_VIDEO_GENERATE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_data: analysisData,
        ads_config: createTabAdsConfig,
        generated_prompts: generatedPrompts,
        audioKeys,
        audio_keys: audioKeys,
        audioUrls,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Video generation failed");
    return Array.isArray(data) ? data : [];
  }

  async function runImageAdPipeline() {
    const res = await fetch(CREATE_AD_IMAGE_RUN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_data: analysisData,
        ads_config: createTabAdsConfig,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image ad pipeline failed");
    return data;
  }

  async function handleCreateTabTriggerAds() {
    if (!analysisData) {
      addSbToast("No analysis data available. Run an analysis in Competitors first.", "error");
      return;
    }
    const config = createTabAdsConfig;
    markCreateAdClientGenerationActive();
    setCreateTabConfigOpen(true);

    // Only show loading on cards that have an idea filled in
    const generatingMap: Record<string, boolean> = {};
    (createTabAdsConfig.items || []).forEach((item: any) => {
      if (item.idea && item.idea.trim()) {
        generatingMap[item.id] = true;
      }
    });
    setAdScenesGenerating(generatingMap);
    setAdStatus("generating");
    setWebhookError("");

    // Start 9-minute prompt generation progress bar
    const promptStart = Date.now();
    window.localStorage.setItem(PROMPT_GEN_START_KEY, String(promptStart));
    setPromptGenProgress(0);
    clearInterval(promptGenTimerRef.current);
    promptGenTimerRef.current = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - promptStart) / PROMPT_GEN_DURATION) * 100);
      setPromptGenProgress(Math.round(pct));
      if (Date.now() - promptStart >= PROMPT_GEN_DURATION) clearInterval(promptGenTimerRef.current);
    }, 2000);

    try {
      await startCreateAdJob("prompts", {
        report_id: analysisData?.id || crypto.randomUUID(),
        report_data: analysisData,
        ads_config: config,
      });
      addSbToast("Generating prompts in the background…", "success");
    } catch (e: any) {
      setAdStatus("error");
      setWebhookError(e.message || "Failed to start prompt generation");
      clearCreateAdClientGenerationMarkers();
      setAdScenesGenerating({});
      clearInterval(promptGenTimerRef.current);
      window.localStorage.removeItem(PROMPT_GEN_START_KEY);
      setPromptGenProgress(0);
      addSbToast("Failed to generate ad prompts. Try again.", "error");
    }
  }

  function startVideoGenProgress() {
    const start = Date.now();
    videoGenStartRef.current = start;
    videoGeneratingRef.current = true;
    generationHandledRef.current = false;
    markCreateAdClientGenerationActive();
    setCreateTabConfigOpen(true);
    window.localStorage.setItem("app_video_gen_start", String(start));
    setVideoGenerating(true);
    setVideoGenProgress(0);
    clearInterval(videoGenTimerRef.current);
    videoGenTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(99, (elapsed / VIDEO_GEN_DURATION) * 100);
      setVideoGenProgress(Math.round(pct));
      if (elapsed >= VIDEO_GEN_DURATION) {
        clearInterval(videoGenTimerRef.current);
        clearInterval(videoGenPollRef.current);
        addSbToast("Video generation may still be running. Check Ad Previews to see results.", "info");
      }
    }, 2000);
    startAdCompletionPolling(start);
  }

  function stopVideoGenProgress(success = true) {
    clearInterval(videoGenTimerRef.current);
    clearInterval(videoGenPollRef.current);
    window.localStorage.removeItem("app_video_gen_start");
    if (!imageGeneratingRef.current) {
      clearCreateAdClientGenerationMarkers();
    }
    videoGenStartRef.current = null;
    videoGeneratingRef.current = false;
    generationActiveRef.current = false;
    if (success) {
      setVideoGenProgress(100);
      setTimeout(() => { setVideoGenerating(false); setVideoGenProgress(0); }, 1500);
    } else {
      setVideoGenerating(false);
      setVideoGenProgress(0);
    }
  }

  /** Build flat index map: response index → { itemId, sceneIndex, scene } */
  function buildSceneIndexMap() {
    const map: Array<{ itemId: any; sceneIndex: number; scene: any }> = [];
    (createTabAdsConfig.items || []).forEach((item: any) => {
      (adScenesMap[item.id] || []).forEach((scene: any, si: number) => {
        map.push({ itemId: item.id, sceneIndex: si, scene });
      });
    });
    return map;
  }

  /** Parse failures from generation response — handles arrays of multiple response objects (one per ad item/type) */
  /**
   * Parse generation failures from pipeline response.
   *
   * Key design: each generation run handles ONE ad at a time, so the response is for a single ad.
   * results[i].index is LOCAL to that ad (0 = scene 0 of that ad, not global scene 0).
   * Primary match strategy: prompt text comparison (most reliable).
   * Fallback: once we identify which itemId owns this response via a successful result's
   * prompt, use local index within that item's scenes.
   */
  function parseGenerationFailures(responseData: any, indexMap: Array<{ itemId: any; sceneIndex: number; scene: any }>) {
    const responses: any[] = Array.isArray(responseData) ? responseData.flat() : [responseData];
    const seen = new Set<string>();
    const failures: any[] = [];

    /** Match a prompt string to the indexMap by text similarity */
    const matchByPrompt = (prompt: string) => {
      if (!prompt || prompt.length < 20) return null;
      const needle = prompt.slice(0, 80).toLowerCase();
      return indexMap.find(m => {
        const hay = (m.scene?.prompt || m.scene?.prompt_clean || "").slice(0, 80).toLowerCase();
        return hay && (hay === needle || hay.includes(needle.slice(0, 50)) || needle.includes(hay.slice(0, 50)));
      }) ?? null;
    };

    responses.forEach((raw) => {
      if (!raw || typeof raw !== "object") return;

      // ── Step 1: identify which itemId this entire response belongs to ──
      // Use the first SUCCESS result's prompt to detect the owning item
      let ownerItemId: any = null;
      if (Array.isArray(raw.results)) {
        for (const r of raw.results) {
          const m = matchByPrompt(r.prompt || "");
          if (m) { ownerItemId = m.itemId; break; }
        }
      }

      // ── Step 2: get the scenes for this item (for local-index fallback) ──
      const ownerScenes = ownerItemId !== null
        ? indexMap.filter(m => m.itemId === ownerItemId)
        : [];

      // ── Step 3: extract failures from results[] ──
      if (Array.isArray(raw.results)) {
        raw.results
          .filter((r: any) => r.success === false || r.state === "fail" || r.state === "error")
          .forEach((r: any) => {
            const key = r.taskId || (r.prompt || "").slice(0, 80) || String(r.index);
            if (seen.has(key)) return;
            seen.add(key);

            // Primary: match by prompt text
            let mapped = matchByPrompt(r.prompt || "");
            // Fallback: local index within the detected item
            if (!mapped && ownerScenes.length > 0) mapped = ownerScenes[r.index] ?? null;
            // Last resort: global index
            if (!mapped) mapped = indexMap[r.index] ?? null;

            failures.push({
              taskId: r.taskId || "",
              prompt: r.prompt || "",
              failMsg: r.failMsg || r.reason || "Generation failed.",
              itemId: mapped?.itemId ?? ownerItemId ?? null,
              sceneIndex: mapped?.sceneIndex ?? r.index,
              scene: mapped?.scene ?? null,
            });
          });
      }

      // ── Step 4: failedPrompts[] as additional fallback ──
      if (Array.isArray(raw.failedPrompts)) {
        raw.failedPrompts.forEach((fp: any) => {
          const prompt = fp.prompt || "";
          const key = prompt.slice(0, 80);
          if (seen.has(key)) return; // already captured via results[]
          seen.add(key);
          const mapped = matchByPrompt(prompt);
          failures.push({
            taskId: "",
            prompt,
            failMsg: fp.reason || "Generation failed.",
            itemId: mapped?.itemId ?? ownerItemId ?? null,
            sceneIndex: mapped?.sceneIndex ?? null,
            scene: mapped?.scene ?? null,
          });
        });
      }
    });

    return failures;
  }

  /** Returns itemIds of ads where ALL scenes succeeded (failCount === 0 for that ad's response) */
  function parseGenerationSuccesses(responseData: any, indexMap: Array<{ itemId: any; sceneIndex: number; scene: any }>): string[] {
    const responses: any[] = Array.isArray(responseData) ? responseData.flat() : [responseData];
    const successIds: string[] = [];

    responses.forEach((raw) => {
      if (!raw || typeof raw !== "object") return;
      // Only mark complete if zero failures in this response object
      const failCount = typeof raw.failCount === "number" ? raw.failCount
        : Array.isArray(raw.results) ? raw.results.filter((r: any) => !r.success || r.state === "fail" || r.state === "error").length
        : 1;
      if (failCount > 0) return;

      // Detect owner itemId by matching any result's prompt
      let ownerItemId: any = null;
      if (Array.isArray(raw.results)) {
        for (const r of raw.results) {
          const prompt = (r.prompt || "").trim();
          if (!prompt || prompt.length < 20) continue;
          const needle = prompt.slice(0, 80).toLowerCase();
          const match = indexMap.find(m => {
            const hay = (m.scene?.prompt || m.scene?.prompt_clean || "").slice(0, 80).toLowerCase();
            return hay && (hay === needle || hay.includes(needle.slice(0, 50)) || needle.includes(hay.slice(0, 50)));
          });
          if (match) { ownerItemId = match.itemId; break; }
        }
      }
      if (ownerItemId && !successIds.includes(String(ownerItemId))) {
        successIds.push(String(ownerItemId));
      }
    });

    return successIds;
  }

  function indexMapFromJobInput(input: any) {
    const raw = input?.scene_index_map || [];
    return (Array.isArray(raw) ? raw : []).map((m: any) => ({
      itemId: m.itemId,
      sceneIndex: m.sceneIndex,
      scene: m.scene ?? null,
    }));
  }

  const applyCreateAdJobResult = useCallback((job: any) => {
    window.localStorage.removeItem(CREATE_AD_JOB_ID_KEY);
    setActiveCreateAdJobId(null);
    clearInterval(promptGenTimerRef.current);
    window.localStorage.removeItem(PROMPT_GEN_START_KEY);
    setPromptGenProgress(0);
    setAdScenesGenerating({});

    if (job.status === "failed") {
      clearCreateAdClientGenerationMarkers();
      setAdStatus("error");
      setWebhookError(job.error || "Generation failed");
      stopVideoGenProgress(false);
      setGenerationActive(false);
      generationActiveRef.current = false;
      setImageGenerating(false);
      imageGeneratingRef.current = false;
      setRetryingItemId(null);
      setRetryItemProgress(0);
      addSbToast(job.error || "Generation failed", "error");
      return;
    }

    if (job.status !== "completed") return;

    if (job.kind === "prompts") {
      const data = job.result;
      const config = (job.input?.ads_config || createTabAdsConfig) as any;
      const scenesMap: any = {};
      const audioKeysMap: any = {};
      const audioUrlsMap: any = {};
      (config.items || []).forEach((item: any, idx: number) => {
        const match = Array.isArray(data)
          ? data.find((d: any) => d.itemIndex === idx || d.itemId === item.id) || data[idx]
          : null;
        scenesMap[item.id] = match?.scenes || [];
        audioKeysMap[item.id] = match?.audioKey || "";
        audioUrlsMap[item.id] = match?.audioUrl || "";
      });
      setAdScenesMap(scenesMap);
      setAdAudioKeysMap(audioKeysMap);
      setAdAudioUrlsMap(audioUrlsMap);
      setAdStatus("done");
      clearCreateAdClientGenerationMarkers();
      addSbToast("Ad prompts generated! Click \"View Prompts\" on each ad.", "success");
      return;
    }

    if (job.kind === "video") {
      const indexMap = indexMapFromJobInput(job.input);
      const responseData = job.result;
      const retryItemId = job.input?.retryItemId as string | undefined;

      const failures = parseGenerationFailures(responseData, indexMap);
      const successes = parseGenerationSuccesses(responseData, indexMap);

      if (successes.length > 0) {
        setCompletedItemIds((prev) => [...new Set([...prev, ...successes])]);
      }

      if (job.input?.jobContext === "retry_all") {
        clearInterval(retryGenTimerRef.current);
        if (failures.length > 0) {
          setFailedPrompts(failures);
          setRetryGenProgress(0);
          setRetryGenActive(false);
          addSbToast(`⚠️ ${failures.length} still failing. Edit and retry again.`, "error");
        } else {
          setRetryGenProgress(100);
          setFailedPrompts([]);
          setTimeout(() => {
            setRetryGenActive(false);
            setRetryGenProgress(0);
            resetCreateTabWorkspace();
          }, 1500);
          addSbToast("✅ Retry successful! Check Ad Previews.", "success");
          fetchAdTableLinks();
        }
        return;
      }

      if (retryItemId) {
        clearInterval(retryGenTimerRef.current);
        const newFailures = failures;
        setFailedPrompts((prev: any[]) => {
          const others = prev.filter((f) => String(f.itemId) !== retryItemId);
          const updated = [...others, ...newFailures];
          if (updated.length === 0) setTimeout(() => resetCreateTabWorkspace(), 1000);
          return updated;
        });
        if (newFailures.length === 0) {
          setRetryItemProgress(100);
          setTimeout(() => {
            setRetryItemProgress(0);
            setRetryingItemId(null);
          }, 1500);
          addSbToast("✅ Retry successful! Check Ad Previews.", "success");
          fetchAdTableLinks();
        } else {
          setRetryItemProgress(0);
          setRetryingItemId(null);
          addSbToast(`⚠️ ${newFailures.length} scene(s) still failing. Edit and retry again.`, "error");
        }
      } else if (failures.length > 0) {
        stopVideoGenProgress(false);
        setGenerationActive(false);
        generationActiveRef.current = false;
        setFailedPrompts(failures);
        addSbToast(`⚠️ ${failures.length} scene(s) failed. Click the red card to view and fix prompts.`, "error");
      } else {
        stopVideoGenProgress(true);
        setGenerationActive(false);
        generationActiveRef.current = false;
        clearCreateAdClientGenerationMarkers();
        fetchAdTableLinks();
        addSbToast("✅ Video generation complete! Check Ad Previews.", "success");
      }
      return;
    }

    if (job.kind === "image") {
      clearInterval(imageGenTimerRef.current);
      clearInterval(videoGenPollRef.current);
      window.localStorage.removeItem(IMAGE_GEN_START_KEY);
      clearCreateAdClientGenerationMarkers();
      videoGenStartRef.current = null;
      setImageGenerating(false);
      imageGeneratingRef.current = false;
      setImageGenProgress(100);
      addSbToast("Image ad generated successfully!", "success");
      fetchAdTableLinks();
      resetCreateTabWorkspace();
    }
  }, [addSbToast, createTabAdsConfig, fetchAdTableLinks]);

  applyCreateAdJobResultRef.current = applyCreateAdJobResult;

  async function startCreateAdJob(kind: "prompts" | "video" | "image", payload: Record<string, unknown>) {
    const res = await fetch(CREATE_AD_JOBS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
    const data = await res.json();
    if (res.status === 409 && data.jobId) {
      window.localStorage.setItem(CREATE_AD_JOB_ID_KEY, data.jobId);
      setActiveCreateAdJobId(data.jobId);
      markCreateAdClientGenerationActive();
      return data.jobId as string;
    }
    if (!res.ok) throw new Error(data.error || "Failed to start Create Ad job");
    window.localStorage.setItem(CREATE_AD_JOB_ID_KEY, data.jobId);
    setActiveCreateAdJobId(data.jobId);
    markCreateAdClientGenerationActive();
    return data.jobId as string;
  }

  /** IMAGE — native pipeline with client-side polling */
  async function handleImageGenerate() {
    const item = createTabAdsConfig.items[0];
    if (!item) return;

    setImageGenerating(true);
    imageGeneratingRef.current = true;
    setImageGenProgress(0);
    setFailedPrompts([]);
    markCreateAdClientGenerationActive();
    setCreateTabConfigOpen(true);

    const imgStart = Date.now();
    videoGenStartRef.current = imgStart;
    generationHandledRef.current = false;
    window.localStorage.setItem(IMAGE_GEN_START_KEY, String(imgStart));
    startAdCompletionPolling(imgStart);
    clearInterval(imageGenTimerRef.current);
    imageGenTimerRef.current = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - imgStart) / IMAGE_GEN_DURATION) * 100);
      setImageGenProgress(Math.round(pct));
      if (Date.now() - imgStart >= IMAGE_GEN_DURATION) {
        clearInterval(imageGenTimerRef.current);
        addSbToast("Image generation may still be running. Check Ad Previews to see results.", "info");
      }
    }, 2000);

    try {
      await startCreateAdJob("image", {
        report_data: analysisData,
        ads_config: createTabAdsConfig,
      });
      addSbToast("Image generation started in the background…", "success");
    } catch (e: any) {
      clearInterval(imageGenTimerRef.current);
      clearInterval(videoGenPollRef.current);
      window.localStorage.removeItem(IMAGE_GEN_START_KEY);
      clearCreateAdClientGenerationMarkers();
      videoGenStartRef.current = null;
      setImageGenerating(false);
      imageGeneratingRef.current = false;
      setImageGenProgress(0);
      addSbToast(e?.message || "Image generation failed.", "error");
    }
  }

  async function handleAcceptPrompts() {
    const videosMissingVoice = (createTabAdsConfig.items || []).filter(
      (item: any) => item.type === "video" && item.audioStyle !== "Background Music" && !voiceLabels[item.id]
    );
    if (videosMissingVoice.length > 0) {
      addSbToast(`Please select a voice for all video ads before accepting. ${videosMissingVoice.length} video(s) missing a voice.`, "error");
      return;
    }

    setAcceptingPrompts(true);
    setFailedPrompts([]);
    setFailedImagePrompts([]);

    // Capture index map and payload BEFORE resetting workspace
    const indexMap = buildSceneIndexMap();
    const enrichedConfig = {
      ...createTabAdsConfig,
      items: (createTabAdsConfig.items || []).map((item: any) => ({
        ...item, audioKey: adAudioKeysMap[item.id] || ""
      }))
    };
    const payload = {
      report_id: analysisData?.id || crypto.randomUUID(),
      report_data: analysisData,
      ads_config: enrichedConfig,
      generated_prompts: adScenesMap,
      audioKeys: adAudioKeysMap,
      audio_keys: adAudioKeysMap,
      audioUrls: adAudioUrlsMap,
      scene_index_map: indexMap.map((m) => ({
        itemId: m.itemId,
        sceneIndex: m.sceneIndex,
        scene: m.scene,
      })),
    };

    // ── IMMEDIATE: unblock UI, start progress bar, keep workspace cards visible ──
    setAcceptingPrompts(false);
    setGenerationActive(true);
    generationActiveRef.current = true;
    setFailedPrompts([]);
    startVideoGenProgress();
    addSbToast("✅ Prompts accepted! Generation started — cards will update when done.", "success");

    startCreateAdJob("video", payload).catch((err: any) => {
      stopVideoGenProgress(false);
      setGenerationActive(false);
      generationActiveRef.current = false;
      clearCreateAdClientGenerationMarkers();
      const msg = err?.message || "Video generation failed. Try again.";
      addSbToast(msg.includes("upload-post") || msg.includes("Upload Post") ? `Video stitch failed: check your Upload Post API token in Integrations. (${msg})` : msg, "error");
    });
  }

  /** Update a failed prompt's text (user edits it before retrying) */
  function updateFailedPromptText(index: number, newPrompt: string) {
    setFailedPrompts((prev: any[]) => prev.map((f, i) => i === index ? { ...f, prompt: newPrompt } : f));
  }

  /** Start Again — sends error cards (with edited prompts) + not-started cards in one request */
  function handleStartAgain() {
    const errorItemIds = new Set((failedPrompts as any[]).map((f: any) => String(f.itemId)).filter(Boolean));
    const notStartedItems = (createTabAdsConfig.items || []).filter((item: any) =>
      !completedItemIds.includes(String(item.id)) && !errorItemIds.has(String(item.id))
    );

    const scenesForRequest: Record<string, any[]> = {};
    const newIndexMap: Array<{ itemId: any; sceneIndex: number; scene: any }> = [];

    // Error items with user-edited prompts
    errorItemIds.forEach((itemId) => {
      const allScenes: any[] = adScenesMap[itemId] || [];
      const edits: Record<number, string> = {};
      (failedPrompts as any[]).filter(f => String(f.itemId) === itemId).forEach(f => {
        edits[f.sceneIndex] = f.prompt;
      });
      scenesForRequest[itemId] = allScenes.map((s: any, i: number) =>
        edits[i] !== undefined ? { ...s, prompt: edits[i], prompt_clean: edits[i] } : s
      );
      scenesForRequest[itemId].forEach((s: any, i: number) => {
        newIndexMap.push({ itemId, sceneIndex: i, scene: s });
      });
    });

    // Not-started items with original prompts
    notStartedItems.forEach((item: any) => {
      const scenes: any[] = adScenesMap[item.id] || [];
      scenesForRequest[item.id] = scenes;
      scenes.forEach((s: any, i: number) => {
        newIndexMap.push({ itemId: item.id, sceneIndex: i, scene: s });
      });
    });

    if (Object.keys(scenesForRequest).length === 0) return;

    // Reset failed prompts, start generation
    setFailedPrompts([]);
    setGenerationActive(true);
    generationActiveRef.current = true;
    startVideoGenProgress();
    addSbToast(`🔄 Restarting generation for ${Object.keys(scenesForRequest).length} ad(s)…`, "success");

    const payload = {
      report_id: analysisData?.id || crypto.randomUUID(),
      report_data: analysisData,
      ads_config: createTabAdsConfig,
      generated_prompts: scenesForRequest,
      audioKeys: adAudioKeysMap,
      audio_keys: adAudioKeysMap,
      audioUrls: adAudioUrlsMap,
      is_retry: true,
      scene_index_map: newIndexMap.map((m) => ({
        itemId: m.itemId,
        sceneIndex: m.sceneIndex,
        scene: m.scene,
      })),
    };

    startCreateAdJob("video", payload).catch(() => {
      stopVideoGenProgress(false);
      setGenerationActive(false);
      generationActiveRef.current = false;
      addSbToast("Failed to restart video generation.", "error");
    });
  }

  /** Retry a single card — sends ALL scenes for that ad with edited prompts merged in */
  function handleRetryCard(itemId: string) {
    if (retryingItemId) return; // one retry at a time
    setRetryingItemId(itemId);
    setRetryItemProgress(0);

    const allScenes: any[] = adScenesMap[itemId] || [];
    // Build map of user-edited prompts by sceneIndex
    const edits: Record<number, string> = {};
    (failedPrompts as any[])
      .filter(f => String(f.itemId) === itemId)
      .forEach(f => { edits[f.sceneIndex] = f.prompt; });

    // Merge edits into all scenes
    const updatedScenes = allScenes.map((scene: any, si: number) =>
      edits[si] !== undefined ? { ...scene, prompt: edits[si], prompt_clean: edits[si] } : scene
    );

    const indexMap = updatedScenes.map((scene: any, si: number) => ({ itemId, sceneIndex: si, scene }));

    const CARD_RETRY_DURATION = 600_000;
    const retryStart = Date.now();
    clearInterval(retryGenTimerRef.current);
    retryGenTimerRef.current = setInterval(() => {
      setRetryItemProgress(Math.min(99, Math.round(((Date.now() - retryStart) / CARD_RETRY_DURATION) * 100)));
    }, 2000);

    const payload = {
      report_id: analysisData?.id || crypto.randomUUID(),
      report_data: analysisData,
      ads_config: createTabAdsConfig,
      generated_prompts: { [itemId]: updatedScenes },
      audioKeys: adAudioKeysMap,
      audio_keys: adAudioKeysMap,
      audioUrls: adAudioUrlsMap,
      is_retry: true,
      retryItemId: itemId,
      scene_index_map: indexMap.map((m) => ({
        itemId: m.itemId,
        sceneIndex: m.sceneIndex,
        scene: m.scene,
      })),
    };

    startCreateAdJob("video", payload).catch(() => {
      clearInterval(retryGenTimerRef.current);
      setRetryingItemId(null);
      setRetryItemProgress(0);
      addSbToast("Retry request failed.", "error");
    });
  }

  /** Retry: send ALL scenes for each errored ad (not just failed scenes) — one request, one progress bar */
  async function handleRetryFailed() {
    if (failedPrompts.length === 0) return;
    setRetryGenActive(true);
    setRetryGenProgress(0);

    // Collect unique itemIds that had failures
    const erroredItemIds = new Set((failedPrompts as any[]).map((f) => String(f.itemId)).filter(Boolean));

    // Build scene map: send ALL scenes for each errored ad
    // Merge user-edited prompts into the correct scenes
    const editedPromptsBySceneIndex: Record<string, Record<number, string>> = {};
    (failedPrompts as any[]).forEach((fail) => {
      const key = String(fail.itemId);
      if (!editedPromptsBySceneIndex[key]) editedPromptsBySceneIndex[key] = {};
      editedPromptsBySceneIndex[key][fail.sceneIndex] = fail.prompt;
    });

    const retryScenesMap: Record<string, any[]> = {};
    const newIndexMap: Array<{ itemId: any; sceneIndex: number; scene: any }> = [];

    erroredItemIds.forEach((itemId) => {
      const allScenes: any[] = adScenesMap[itemId] || [];
      if (allScenes.length === 0) return;
      retryScenesMap[itemId] = allScenes.map((scene: any, si: number) => {
        // Apply user edits to scenes that were failed
        const editedPrompt = editedPromptsBySceneIndex[itemId]?.[si];
        return editedPrompt
          ? { ...scene, prompt: editedPrompt, prompt_clean: editedPrompt }
          : scene;
      });
      allScenes.forEach((scene: any, si: number) => {
        const editedPrompt = editedPromptsBySceneIndex[itemId]?.[si];
        const finalScene = editedPrompt ? { ...scene, prompt: editedPrompt, prompt_clean: editedPrompt } : scene;
        newIndexMap.push({ itemId, sceneIndex: si, scene: finalScene });
      });
    });

    // One progress bar for all — 5 min max
    const RETRY_DURATION = 300_000;
    const retryStart = Date.now();
    clearInterval(retryGenTimerRef.current);
    retryGenTimerRef.current = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - retryStart) / RETRY_DURATION) * 100);
      setRetryGenProgress(Math.round(pct));
      if (Date.now() - retryStart >= RETRY_DURATION) clearInterval(retryGenTimerRef.current);
    }, 2000);

    const payload = {
      report_id: analysisData?.id || crypto.randomUUID(),
      report_data: analysisData,
      ads_config: createTabAdsConfig,
      generated_prompts: retryScenesMap,
      audioKeys: adAudioKeysMap,
      audio_keys: adAudioKeysMap,
      audioUrls: adAudioUrlsMap,
      is_retry: true,
      jobContext: "retry_all",
      scene_index_map: newIndexMap.map((m) => ({
        itemId: m.itemId,
        sceneIndex: m.sceneIndex,
        scene: m.scene,
      })),
    };

    startCreateAdJob("video", payload).catch(() => {
      clearInterval(retryGenTimerRef.current);
      setRetryGenActive(false);
      setRetryGenProgress(0);
      addSbToast("Error during retry.", "error");
    });
  }

  /** Returns true if this ad slot has any failed generation result */
  function doesSlotHaveError(itemId: any): boolean {
    if (failedPrompts.length === 0) return false;
    const id = String(itemId);
    return (failedPrompts as any[]).some((fail) => String(fail.itemId) === id);
  }

  function formatSbDate(iso) {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    return `${day} ${mon} ${d.getFullYear()}`;
  }

  function formatSbTime(iso) {
    if (!iso) return "00:00";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function truncateSb(str, len = 200) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  function toggleSbSort(field) {
    if (sbSortField === field) setSbSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSbSortField(field); setSbSortDir("desc"); }
  }

  // ── Action 1: Competitor Analysis ──
  async function runCompetitorAnalysis() {
    const startRaw = window.localStorage.getItem("app_analysis_start");
    const startTime = startRaw ? Number(startRaw) : null;
    const isRecentRun = Boolean(startTime && Date.now() - startTime < 360_000);

    if (analysisInFlightRef.current || analysisStatus === "generating" || isRecentRun) {
      addSbToast("An analysis is already running. Wait for it to finish before starting another.", "error");
      return;
    }

    if (integrationsConfigured !== true) {
      addSbToast("Configure API keys in Settings before running competitor analysis.", "error");
      return;
    }

    // Read keywords directly from localStorage to avoid stale closure after async delay
    let kwSnapshot: string[] = researchKeywords;
    try {
      const stored = window.localStorage.getItem(RESEARCH_KEYWORDS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0 && !isLegacyResearchKeywords(parsed)) {
          kwSnapshot = parsed;
        }
      }
    } catch {}

    if (kwSnapshot.length === 0) {
      addSbToast("Please add at least one keyword before running analysis.", "error");
      return;
    }

    if (!researchScrapeImage && !researchScrapeVideo) {
      addSbToast("Select at least one ad format to scrape (image or video).", "error");
      return;
    }

    analysisInFlightRef.current = true;
    setAnalysisData(null);
    setAnalysisError("");
    setAnalysisProgress(0);
    setAnalysisPhaseIndex(0);
    setAnalysisStatusMessage(ANALYSIS_PIPELINE_PHASES[0].status);
    const analysisTopic = kwSnapshot[0] || selectedTopic || "Tenant Screening";
    window.localStorage.setItem("app_analysis_start", String(Date.now()));
    sessionStorage.setItem("app_analysis_active", "1"); // marks this session as the one that fired
    setAnalysisStatus("generating");
    setPendingAnalysisTopic(analysisTopic);
    pendingTopicRef.current = analysisTopic;
    await new Promise((r) => setTimeout(r, 100));

    try {
      const brandConfig = getBrandConfigForAnalysis();
      const res = await fetch(COMPETITOR_ANALYSIS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: analysisTopic,
          keywords: kwSnapshot,
          countries: researchCountries,
          max_ads: Number(researchMaxAds) || 100,
          only_active: researchOnlyActive,
          scrape_image: researchScrapeImage,
          scrape_video: researchScrapeVideo,
          sort: researchSort,
          brand_config: brandConfig,
          brand_snapshot_id: activeBrandSnapshot?.id !== "current" ? activeBrandSnapshot?.id : null,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await res.json().catch(() => null);

      if (result && result.success && !result.error) {
        freshAnalysisResultRef.current = true;
        expandTopicCollapseResults();
        setAnalysisData(result);
        setAnalysisStatus("done");
        setAnalysisProgress(100);
        window.localStorage.removeItem("app_analysis_start");
        sessionStorage.removeItem("app_analysis_active");
        setPendingAnalysisTopic(null);
        addSbToast("Analysis complete!", "success");
      } else if (result?.error) {
        setAnalysisStatus("error");
        setAnalysisProgress(0);
        window.localStorage.removeItem("app_analysis_start");
        sessionStorage.removeItem("app_analysis_active");
        setAnalysisError(result.error);
        addSbToast(`Analysis failed: ${result.error}`, "error");
      } else {
        setAnalysisStatus("error");
        setAnalysisProgress(0);
        window.localStorage.removeItem("app_analysis_start");
        sessionStorage.removeItem("app_analysis_active");
        setAnalysisError("No analysis data returned");
        addSbToast("Analysis failed: no data returned", "error");
      }
    } catch (err: any) {
      console.error("[Analysis] Unexpected error:", err);
      setAnalysisStatus("error");
      setAnalysisProgress(0);
      window.localStorage.removeItem("app_analysis_start");
      sessionStorage.removeItem("app_analysis_active");
      setAnalysisError(err.message || "Unexpected error");
      addSbToast(`Analysis error: ${err.message || "Unknown"}`, "error");
    } finally {
      analysisInFlightRef.current = false;
    }
  }

  // ── Receive analysis result ──
  function receiveAnalysisResult(data) {
    setAnalysisData(data);
    setAnalysisStatus("done");
  }

  // ── DEV: simulate analysis response ──
  function simulateAnalysisResponse() {
    receiveAnalysisResult({
      success: true,
      executive_summary: "Clinical excellence and patient-centric care are the primary drivers for local healthcare providers. Digital presence is currently under-utilized, offering a significant opportunity to capture high-intent search traffic through specialized service campaigns.",
      competitors_table: [
        { name: "Global Health Clinic", ads: 14, score: 72, threat: "High", angle: "Surgical precision", hook: "JCI accredited care you can trust" },
        { name: "Wellness Prime", ads: 9, score: 85, threat: "High", angle: "Preventative focus", hook: "Your health journey, optimized" },
      ],
      hooks_table: [
        { pattern: "Treatment results", example: "Before treatment → Patient recovery", reason: "Visual results validate clinical efficacy", score: "8.1" },
      ],
      market_insights_table: [
        { field: "Dominant platform", value: "Meta (Instagram Reels)" },
        { field: "Average CPC", value: "€1.20" },
        { field: "Top ad format", value: "Video reel — 28 sec" },
        { field: "Trending style", value: "Anime & illustrative (+3×)" },
        { field: "Peak booking time", value: "Thu–Sat, 6–10 pm" },
        { field: "Avg. competitor spend", value: "€60/day" },
      ],
      gaps_table: [
        { gap: "Quality vs price", opportunity: "Counter discount-led ads with award proof", priority: "High", impact: "High CTR, lower CPA" },
        { gap: "Orthopedic specialization", opportunity: "Target 'hip replacement surgery' keywords", priority: "Medium", impact: "High-intent patient traffic" },
        { gap: "Seasonal hooks missing", opportunity: "Halloween piercing + costume combo campaign", priority: "Medium", impact: "Timely spike in bookings" },
        { gap: "Diagnostic Focus", opportunity: "Target 'MRI and diagnostic imaging' keywords", priority: "Medium", impact: "High-intent service volume" },
        { gap: "Patient Transparency", opportunity: "Virtual facility tour & specialist profiles", priority: "Low", impact: "Clinical trust & patient retention" },
      ],
    });
  }

  // ── Approval helpers ──
  function getAdStatus(adId) {
    return adCardStatuses[adId] || "pending";
  }

  function approveAd(ad) {
    setAdCardStatuses(prev => ({ ...prev, [ad.id]: "approved" }));
    setApprovedAds(prev => [...prev.filter(a => a.id !== ad.id), ad]);
    setSchedulePickerOpen(null);
  }

  function rejectAd(adId) {
    setAdCardStatuses(prev => ({ ...prev, [adId]: "rejected" }));
    setApprovedAds(prev => prev.filter(a => a.id !== adId));
    setScheduledAds(prev => prev.filter(a => a.id !== adId));
    setSchedulePickerOpen(null);
  }

  function scheduleAd(ad) {
    const dateInfo = scheduleDates[ad.id];
    if (!dateInfo?.date) return;
    const scheduledAt = `${dateInfo.date} ${dateInfo.time || "09:00"}`;
    setAdCardStatuses(prev => ({ ...prev, [ad.id]: "scheduled" }));
    setScheduledAds(prev => [
      ...prev.filter(a => a.id !== ad.id),
      { ...ad, scheduledAt },
    ]);
    setSchedulePickerOpen(null);
  }

  function undoAction(adId) {
    setAdCardStatuses(prev => ({ ...prev, [adId]: "pending" }));
    setApprovedAds(prev => prev.filter(a => a.id !== adId));
    setScheduledAds(prev => prev.filter(a => a.id !== adId));
    setRejectedAds(prev => prev.filter(a => a.id !== adId));
  }

  function approveAllPending() {
    (adData?.ad_scripts || [])
      .filter(a => getAdStatus(a.id) === "pending")
      .forEach(ad => approveAd(ad));
  }

  function rejectAllPending() {
    (adData?.ad_scripts || [])
      .filter(a => getAdStatus(a.id) === "pending")
      .forEach(ad => rejectAd(ad.id));
  }

  function countByStatus(status) {
    return (adData?.ad_scripts || []).filter(a => getAdStatus(a.id) === status).length;
  }

  function simulateAdResponse() {
    setAdData({
      topic: selectedTopic,
      headline: "Where Anime Meets Skin — Your Story, Inked Forever",
      body: "Our award-winning artists bring your favourite anime characters to life. Bold lines, vivid colour, unmatched detail. Book your consultation today.",
      cta: "Book Now",
      format: "Video reel — 28 sec",
      platform: "Meta (FB + IG)",
    });
    setAdStatus("done");
  }

  // ─── STYLES ───
  const tabStyle = (id) => ({
    padding: "8px 16px",
    borderRadius: "var(--radius-md)",
    border: "none",
    background: tab === id ? "var(--primary-light)" : "transparent",
    color: tab === id ? "var(--primary-dark)" : "var(--text-muted)",
    fontWeight: tab === id ? 700 : 500,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 7,
    transition: "all 0.18s ease",
    boxShadow: tab === id ? "0 1px 3px rgba(0,48,73,0.12)" : "none",
    fontFamily: "var(--font-sans)",
  });

  const topicBtnStyle = (t) => ({
    fontSize: 12,
    padding: "6px 14px",
    borderRadius: "var(--radius-pill)",
    cursor: "pointer",
    border:
      selectedTopic === t
        ? "1.5px solid var(--primary)"
        : "1px solid var(--border)",
    background:
      selectedTopic === t ? "var(--primary-light)" : "transparent",
    color:
      selectedTopic === t ? "var(--primary)" : "var(--text-muted)",
    fontWeight: selectedTopic === t ? 500 : 400,
    fontFamily: "inherit",
    transition: "all 0.2s ease",
  });

  // ─────────────────────────────────────────────────────────────
  const createAdBackgroundProgress = imageGenerating
    ? imageGenProgress
    : videoGenerating || generationActive
      ? videoGenProgress
      : adStatus === "generating"
        ? promptGenProgress
        : 0;

  const createAdBackgroundStatus =
    adStatus === "generating"
      ? "Generating ad prompts…"
      : imageGenerating
        ? "Generating image ad…"
        : videoGenerating || generationActive
          ? "Generating video ad…"
          : adStatus === "waiting" || isStatusPolling
            ? "Ad pipeline running…"
            : "Create Ad in progress…";

  const socialStudioBackgroundStatus =
    socialStudioJobStatus ||
    (socialStudioJobKind === "video" ? "Generating social video…" : "Generating social image…");

  const socialStudioBackgroundProgress = socialStudioGenerationBusy ? socialStudioGenProgress : 0;

  if (isAuthenticating || !user) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        gap: 16,
      }}>
        <Spinner size={30} color="var(--primary)" />
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: "0.02em",
        }}>
          Loading dashboard…
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        color: "var(--text)",
        minHeight: "100vh",
        display: "flex",
        background: "var(--background)",
      }}
    >
      {/* Full-screen overlay removed — replaced by non-blocking progress bar in Create Ad tab */}

      {embed && <HideNextDevIndicator />}

      {/* ── MOBILE TOP BAR ── */}
      {!embed && (
      <>
      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{ display: "none", position: "fixed", top: 0, left: 0, right: 0, zIndex: 400, background: "var(--card-bg)", borderBottom: "1px solid var(--border)", padding: "10px 16px", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/tenant-report-logo.png" alt="Tenant Report AI" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "contain" }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Tenant Report AI</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(o => !o)}
          style={{ background: mobileMenuOpen ? "var(--primary)" : "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 18, color: mobileMenuOpen ? "#fff" : "var(--text)", transition: "all 0.2s" }}>
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* ── MOBILE BACKDROP ── */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          style={{ display: "none", position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        />
      )}

      {/* ── LEFT SIDEBAR ── */}
      <aside
        className="main-layout-sidebar"
        data-open={mobileMenuOpen ? "true" : "false"}
        style={{
          width: sidebarCollapsed ? 68 : 224,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          color: "var(--sidebar-text)",
          padding: sidebarCollapsed ? "32px 10px" : "32px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          boxShadow: "none",
          zIndex: 100,
          transition: "width 0.25s ease, padding 0.25s ease",
        }}
      >
        {/* Brand + Toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", gap: 8, paddingBottom: 14, borderBottom: "1px solid var(--sidebar-border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
            <img
              src="/tenant-report-logo.png"
              alt="Tenant Report AI"
              style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", objectFit: "contain", background: "#fff", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.10)", cursor: "pointer" }}
              onClick={() => setSidebarCollapsed((v: boolean) => !v)}
            />
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--sidebar-text)", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Tenant Report AI
                </div>
                <div style={{ fontSize: 11, color: "#7FA6BC", letterSpacing: "1.2px", textTransform: "uppercase", marginTop: 2 }}>
                  Growthacker
                </div>
              </div>
            )}
          </div>
          {/* Toggle button — only on desktop */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed((v: boolean) => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: 24, height: 24, borderRadius: 6, border: "1px solid var(--sidebar-border)",
              background: "rgba(250,237,205,0.08)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
              color: "var(--sidebar-muted)", fontSize: 11, transition: "all 0.15s",
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(250,237,205,0.16)"; e.currentTarget.style.color = "var(--sidebar-text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(250,237,205,0.08)"; e.currentTarget.style.color = "var(--sidebar-muted)"; }}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {(() => {
            const metaAdsActive = META_ADS_IDS.has(tab);
            const showMetaAdsChildren = metaAdsOpen;
            const outreachActive = OUTREACH_TABS.some((t) => t.id === tab);
            const showOutreachChildren = outreachOpen;
            const newsletterActive = NEWSLETTER_TABS.some((t) => t.id === tab);
            const showNewsletterChildren = newsletterOpen;
            const socialActive = SOCIAL_TAB_IDS.has(tab);
            const showSocialChildren = socialOpen;
            const blogActive = BLOG_IDS.has(tab);
            const showBlogChildren = blogOpen;
            const configurationActive = CONFIGURATION_IDS.has(tab);
            const showConfigurationChildren = configurationOpen;

            const collapseAllModuleGroups = () => {
              setMetaAdsOpen(false);
              setSocialOpen(false);
              setOutreachOpen(false);
              setNewsletterOpen(false);
              setBlogOpen(false);
              setConfigurationOpen(false);
            };

            const activateModuleGroup = (module: "meta" | "social" | "outreach" | "newsletter" | "blog" | "configuration", firstTabId: string) => {
              collapseAllModuleGroups();
              if (module === "meta") setMetaAdsOpen(true);
              else if (module === "social") setSocialOpen(true);
              else if (module === "outreach") setOutreachOpen(true);
              else if (module === "newsletter") setNewsletterOpen(true);
              else if (module === "blog") setBlogOpen(true);
              else setConfigurationOpen(true);
              setTab(firstTabId);
              setMobileMenuOpen(false);
            };

            const renderTabBtn = (t: any, indent = false) => (
              <div key={t.id} style={{ position: "relative" }} className="sidebar-nav-item">
                <button
                  title={sidebarCollapsed ? t.label : ""}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: sidebarCollapsed ? 0 : 10,
                    padding: sidebarCollapsed ? "10px 0" : indent ? "6px 16px 6px 32px" : "8px 16px",
                    borderRadius: 0,
                    border: "none",
                    borderLeft: tab === t.id ? "2px solid var(--sidebar-active-border)" : "2px solid transparent",
                    fontSize: indent ? 13.5 : 15,
                    fontWeight: tab === t.id ? 700 : 400,
                    textAlign: "left",
                    cursor: "pointer",
                    background: tab === t.id ? "rgba(250,237,205,0.12)" : "transparent",
                    color: tab === t.id ? "var(--sidebar-text)" : indent ? "#9FBBD0" : "var(--sidebar-muted)",
                    transition: "all 0.18s ease",
                    boxShadow: "none",
                    position: "relative",
                    overflow: "hidden",
                    fontFamily: "inherit",
                  }}
                  onClick={() => {
                    if (t.externalLink) { window.open(t.externalLink, "_blank", "noopener,noreferrer"); }
                    else if ("internalPath" in t && t.internalPath) { router.push(t.internalPath); setMobileMenuOpen(false); }
                    else { setTab(t.id); setMobileMenuOpen(false); }
                  }}
                  onMouseEnter={e => { if (tab !== t.id) { e.currentTarget.style.background = "rgba(250,237,205,0.08)"; e.currentTarget.style.color = "var(--sidebar-text)"; e.currentTarget.style.borderLeftColor = "#7FA6BC"; } }}
                  onMouseLeave={e => { if (tab !== t.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-muted)"; e.currentTarget.style.borderLeftColor = "transparent"; } }}
                >
                  {(() => { const Icon = t.icon; return sidebarCollapsed || indent ? <Icon size={indent ? 13 : 15} style={{ flexShrink: 0 }} /> : null; })()}
                  {!sidebarCollapsed && (
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
                  )}
                  {socialStudioGenerationBusy && t.id === "social-creator-studio" && tab !== "social-creator-studio" && (
                    <span
                      title="Creator Studio generation in progress"
                      style={{
                        position: "absolute",
                        top: sidebarCollapsed ? 6 : 10,
                        right: sidebarCollapsed ? 6 : 10,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#C1121F",
                        boxShadow: "0 0 0 2px rgba(193,18,31,0.25)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
                {sidebarCollapsed && (
                  <span className="sidebar-tooltip" style={{
                    position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                    background: "#00263A", color: "#FAEDCD", fontSize: 11, fontWeight: 600,
                    padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                    pointerEvents: "none", zIndex: 9999,
                    opacity: 0, transition: "opacity 0.15s",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}>
                    {t.label}
                  </span>
                )}
              </div>
            );

            return (
              <>
                {/* Meta Ads group */}
                <div style={{ position: "relative" }} className="sidebar-nav-item">
                  <button
                    title={sidebarCollapsed ? "Meta Ads" : ""}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      gap: sidebarCollapsed ? 0 : 10,
                      padding: sidebarCollapsed ? "10px 0" : "8px 16px",
                      borderRadius: 0,
                      border: "none",
                      borderLeft: metaAdsActive ? "2px solid var(--sidebar-active-border)" : "2px solid transparent",
                      fontSize: 15,
                      fontWeight: metaAdsActive ? 700 : 400,
                      textAlign: "left",
                      cursor: "pointer",
                      background: metaAdsActive ? "rgba(250,237,205,0.12)" : showMetaAdsChildren ? "rgba(250,237,205,0.06)" : "transparent",
                      color: metaAdsActive ? "var(--sidebar-text)" : showMetaAdsChildren ? "var(--sidebar-text)" : "var(--sidebar-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => activateModuleGroup("meta", META_ADS_TABS[0].id)}
                    onMouseEnter={e => { if (!metaAdsActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!metaAdsActive) e.currentTarget.style.background = showMetaAdsChildren ? "var(--surface)" : "transparent"; }}
                  >
                    {sidebarCollapsed && <Megaphone size={15} style={{ flexShrink: 0 }} />}
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Meta Ads</span>
                        <span style={{
                          fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
                          transform: showMetaAdsChildren ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}>▼</span>
                      </>
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#00263A", color: "#FAEDCD", fontSize: 11, fontWeight: 600,
                      padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                      pointerEvents: "none", zIndex: 9999,
                      opacity: 0, transition: "opacity 0.15s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}>
                      Meta Ads
                    </span>
                  )}

                  {/* Children — inline below the group header */}
                  {showMetaAdsChildren && (
                    <div style={{
                      background: "rgba(250,237,205,0.06)",
                      borderRadius: 0,
                      borderTop: "1px solid var(--sidebar-border)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {META_ADS_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>

                {/* Social Channels group */}
                <div style={{ position: "relative" }} className="sidebar-nav-item">
                  <button
                    title={sidebarCollapsed ? "Social Channels" : ""}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      gap: sidebarCollapsed ? 0 : 10,
                      padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                      borderRadius: showSocialChildren ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                      border: "none",
                      fontSize: 13,
                      fontWeight: socialActive ? 700 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      background: socialActive ? "rgba(250,237,205,0.12)" : showSocialChildren ? "rgba(250,237,205,0.06)" : "transparent",
                      color: socialActive ? "var(--sidebar-text)" : showSocialChildren ? "var(--sidebar-text)" : "var(--sidebar-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => activateModuleGroup("social", SOCIAL_TABS[0].id)}
                    onMouseEnter={e => { if (!socialActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!socialActive) e.currentTarget.style.background = showSocialChildren ? "var(--surface)" : "transparent"; }}
                  >
                    {sidebarCollapsed && <Share2 size={15} style={{ flexShrink: 0 }} />}
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Social Channels</span>
                        <span style={{
                          fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
                          transform: showSocialChildren ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}>▼</span>
                      </>
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#00263A", color: "#FAEDCD", fontSize: 11, fontWeight: 600,
                      padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                      pointerEvents: "none", zIndex: 9999,
                      opacity: 0, transition: "opacity 0.15s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}>
                      Social Channels
                    </span>
                  )}
                  {showSocialChildren && (
                    <div style={{
                      background: "rgba(250,237,205,0.06)",
                      borderRadius: 0,
                      borderTop: "1px solid var(--sidebar-border)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {SOCIAL_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>

                {/* Outreach group */}
                <div style={{ position: "relative" }} className="sidebar-nav-item">
                  <button
                    title={sidebarCollapsed ? "Cold Email" : ""}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      gap: sidebarCollapsed ? 0 : 10,
                      padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                      borderRadius: showOutreachChildren ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                      border: "none",
                      fontSize: 13,
                      fontWeight: outreachActive ? 700 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      background: outreachActive ? "rgba(250,237,205,0.12)" : showOutreachChildren ? "rgba(250,237,205,0.06)" : "transparent",
                      color: outreachActive ? "var(--sidebar-text)" : showOutreachChildren ? "var(--sidebar-text)" : "var(--sidebar-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => activateModuleGroup("outreach", OUTREACH_TABS[0].id)}
                    onMouseEnter={e => { if (!outreachActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!outreachActive) e.currentTarget.style.background = showOutreachChildren ? "var(--surface)" : "transparent"; }}
                  >
                    {sidebarCollapsed && <Send size={15} style={{ flexShrink: 0 }} />}
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Cold Email</span>
                        <span style={{
                          fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
                          transform: showOutreachChildren ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}>▼</span>
                      </>
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#00263A", color: "#FAEDCD", fontSize: 11, fontWeight: 600,
                      padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                      pointerEvents: "none", zIndex: 9999,
                      opacity: 0, transition: "opacity 0.15s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}>
                      Cold Email
                    </span>
                  )}

                  {showOutreachChildren && (
                    <div style={{
                      background: "rgba(250,237,205,0.06)",
                      borderRadius: 0,
                      borderTop: "1px solid var(--sidebar-border)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {OUTREACH_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>

                {OUTREACH_FUTURE_TABS.map((t) => renderTabBtn(t))}

                {/* Newsletter group */}
                <div style={{ position: "relative" }} className="sidebar-nav-item">
                  <button
                    title={sidebarCollapsed ? "Newsletter" : ""}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      gap: sidebarCollapsed ? 0 : 10,
                      padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                      borderRadius: showNewsletterChildren ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                      border: "none",
                      fontSize: 13,
                      fontWeight: newsletterActive ? 700 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      background: newsletterActive ? "rgba(250,237,205,0.12)" : showNewsletterChildren ? "rgba(250,237,205,0.06)" : "transparent",
                      color: newsletterActive ? "var(--sidebar-text)" : showNewsletterChildren ? "var(--sidebar-text)" : "var(--sidebar-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => activateModuleGroup("newsletter", NEWSLETTER_TABS[0].id)}
                    onMouseEnter={e => { if (!newsletterActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!newsletterActive) e.currentTarget.style.background = showNewsletterChildren ? "var(--surface)" : "transparent"; }}
                  >
                    {sidebarCollapsed && <Newspaper size={15} style={{ flexShrink: 0 }} />}
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Newsletter</span>
                        <span style={{
                          fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
                          transform: showNewsletterChildren ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}>▼</span>
                      </>
                    )}
                  </button>
                  {showNewsletterChildren && (
                    <div style={{
                      background: "rgba(250,237,205,0.06)",
                      borderRadius: 0,
                      borderTop: "1px solid var(--sidebar-border)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {NEWSLETTER_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>

                {/* Blog group */}
                <div style={{ position: "relative" }} className="sidebar-nav-item">
                  <button
                    title={sidebarCollapsed ? "Blog" : ""}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      gap: sidebarCollapsed ? 0 : 10,
                      padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                      borderRadius: showBlogChildren ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                      border: "none",
                      fontSize: 13,
                      fontWeight: blogActive ? 700 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      background: blogActive ? "rgba(250,237,205,0.12)" : showBlogChildren ? "rgba(250,237,205,0.06)" : "transparent",
                      color: blogActive ? "var(--sidebar-text)" : showBlogChildren ? "var(--sidebar-text)" : "var(--sidebar-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => activateModuleGroup("blog", BLOG_TABS[0].id)}
                    onMouseEnter={e => { if (!blogActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!blogActive) e.currentTarget.style.background = showBlogChildren ? "var(--surface)" : "transparent"; }}
                  >
                    {sidebarCollapsed && <FileText size={15} style={{ flexShrink: 0 }} />}
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Blog</span>
                        <span style={{
                          fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
                          transform: showBlogChildren ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}>▼</span>
                      </>
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#00263A", color: "#FAEDCD", fontSize: 11, fontWeight: 600,
                      padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                      pointerEvents: "none", zIndex: 9999,
                      opacity: 0, transition: "opacity 0.15s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}>
                      Blog
                    </span>
                  )}

                  {showBlogChildren && (
                    <div style={{
                      background: "rgba(250,237,205,0.06)",
                      borderRadius: 0,
                      borderTop: "1px solid var(--sidebar-border)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {BLOG_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>

                {/* Configuration group */}
                <div style={{ position: "relative" }} className="sidebar-nav-item">
                  <button
                    title={sidebarCollapsed ? "Configuration" : ""}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      gap: sidebarCollapsed ? 0 : 10,
                      padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                      borderRadius: showConfigurationChildren ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                      border: "none",
                      fontSize: 13,
                      fontWeight: configurationActive ? 700 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      background: configurationActive ? "rgba(250,237,205,0.12)" : showConfigurationChildren ? "rgba(250,237,205,0.06)" : "transparent",
                      color: configurationActive ? "var(--sidebar-text)" : showConfigurationChildren ? "var(--sidebar-text)" : "var(--sidebar-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => activateModuleGroup("configuration", CONFIGURATION_TABS[0].id)}
                    onMouseEnter={e => { if (!configurationActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!configurationActive) e.currentTarget.style.background = showConfigurationChildren ? "var(--surface)" : "transparent"; }}
                  >
                    {sidebarCollapsed && <SlidersHorizontal size={15} style={{ flexShrink: 0 }} />}
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Configuration</span>
                        <span style={{
                          fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
                          transform: showConfigurationChildren ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}>▼</span>
                      </>
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#00263A", color: "#FAEDCD", fontSize: 11, fontWeight: 600,
                      padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                      pointerEvents: "none", zIndex: 9999,
                      opacity: 0, transition: "opacity 0.15s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}>
                      Configuration
                    </span>
                  )}

                  {showConfigurationChildren && (
                    <div style={{
                      background: "rgba(250,237,205,0.06)",
                      borderRadius: 0,
                      borderTop: "1px solid var(--sidebar-border)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {CONFIGURATION_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </nav>

        {/* Sidebar Footer (User Profile & Sign Out) */}
        <div style={{ borderTop: "1px solid var(--sidebar-border)", paddingTop: 16, marginTop: 8 }}>
          {user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!sidebarCollapsed && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#669BBC", border: "2px solid #1A4A66", display: "flex", alignItems: "center", justifyContent: "center", color: "#FDF0D5", flexShrink: 0 }}>
                    <User size={13} />
                  </div>
                  <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--sidebar-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin</div>
                    <div style={{ fontSize: 12, color: "#7FA6BC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                  </div>
                </div>
              )}
              <button
                onClick={handleSignOut}
                title={sidebarCollapsed ? "Sign Out" : ""}
                style={{
                  padding: "8px", borderRadius: 0,
                  border: "none", borderBottom: "1px solid #33607C",
                  background: "transparent",
                  color: "#7FA6BC", fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start", gap: 6,
                  transition: "all 0.15s", fontFamily: "inherit", width: "100%"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--sidebar-text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#7FA6BC"; }}
              >
                <LogOut size={13} /> {!sidebarCollapsed && "Sign out"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/login")}
              style={{
                padding: "9px 12px", borderRadius: 999,
                border: "none", background: "var(--red)",
                color: "#FDF0D5", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: "0 4px 12px rgba(193,18,31,0.25)",
                transition: "all 0.15s", fontFamily: "inherit", width: "100%"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#780000"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(193,18,31,0.35)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(193,18,31,0.25)"; }}
            >
              <LogIn size={13} /> Sign In
            </button>
          )}
        </div>
      </aside>
      </>
      )}

      {/* ── RIGHT MAIN CONTENT ── */}
      <main
        className="main-layout-content editorial-shell-main editorial-shell-gutter"
        data-embed={embed ? "true" : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "hidden",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
      {createAdGenerationBusy && tab !== "create" && (
        <div
          role="status"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 200,
            margin: embed ? "0 0 16px" : "0 0 20px",
            padding: "14px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
            border: "1.5px solid #86efac",
            boxShadow: "0 4px 16px rgba(22,163,74,0.12)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Spinner size={14} color="#16a34a" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{createAdBackgroundStatus}</div>
            <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>
              Generation continues while you use other modules. We&apos;ll refresh previews when ready.
            </div>
            {createAdBackgroundProgress > 0 && (
              <div style={{ marginTop: 8, height: 6, background: "#bbf7d0", borderRadius: 6, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${createAdBackgroundProgress}%`,
                    background: "linear-gradient(90deg, #22c55e, #16a34a)",
                    borderRadius: 6,
                    transition: "width 1.5s ease-out",
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTab("create")}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: "#003049",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Open Create Ad →
          </button>
        </div>
      )}

      {socialStudioGenerationBusy && tab !== "social-creator-studio" && (
        <div
          role="status"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 200,
            margin: embed ? "0 0 16px" : "0 0 20px",
            padding: "14px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #fff5f5, #fde8e8)",
            border: "1.5px solid #f5c2c7",
            boxShadow: "0 4px 16px rgba(193,18,31,0.1)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Spinner size={14} color="#C1121F" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#9B2226" }}>
              {socialStudioBackgroundStatus}
            </div>
            <div style={{ fontSize: 11, color: "#C1121F", marginTop: 2 }}>
              Creator Studio keeps working in the background — switch tabs or modules without canceling.
            </div>
            {socialStudioBackgroundProgress > 0 && (
              <div style={{ marginTop: 8, height: 6, background: "#f5c2c7", borderRadius: 6, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${socialStudioBackgroundProgress}%`,
                    background: "linear-gradient(90deg, #C1121F, #9B2226)",
                    borderRadius: 6,
                    transition: "width 1.5s ease-out",
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTab("social-creator-studio")}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: "#003049",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Open Creator Studio →
          </button>
        </div>
      )}

      {variantGenerationBusy.active && tab !== "variants" && (
        <div
          role="status"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 200,
            margin: embed ? "0 0 16px" : "0 0 20px",
            padding: "14px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
            border: "1.5px solid #93c5fd",
            boxShadow: "0 4px 16px rgba(37,99,235,0.12)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Spinner size={14} color="#2563eb" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
              {variantGenerationBusy.label || "Generating ad variants…"}
            </div>
            <div style={{ fontSize: 11, color: "#2563eb", marginTop: 2 }}>
              Variant generation runs on the server — switch tabs or modules without canceling.
            </div>
            {variantGenerationBusy.progress > 0 && (
              <div style={{ marginTop: 8, height: 6, background: "#bfdbfe", borderRadius: 6, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${variantGenerationBusy.progress}%`,
                    background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                    borderRadius: 6,
                    transition: "width 1.5s ease-out",
                  }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTab("variants")}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: "#003049",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Open Variants →
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          OVERVIEW
      ═══════════════════════════════════════════════════════ */}
      {tab === "overview" && (() => {
        // Compute dynamic top statistics
        const activeCampaigns = metaCampaignInsights.filter(c => c.effective_status === 'ACTIVE').length;
        const pausedCampaigns = metaCampaignInsights.filter(c => c.effective_status === 'PAUSED').length;
        const totalCampaignsRendered = activeCampaigns || campaigns.length; // fallback
        const pendingAuthCount = pendingAdsCount;

        // Determine Top Performer
        let topPerformer = null;
        if (metaCampaignInsights.length > 0) {
          topPerformer = [...metaCampaignInsights].sort((a, b) => {
            const ctrA = parseFloat(a.insights?.inline_link_click_ctr || 0);
            const ctrB = parseFloat(b.insights?.inline_link_click_ctr || 0);
            return ctrB - ctrA;
          })[0];
        }

        const spendTotal = parseFloat(metaInsights?.spend || 0);
        const impressionsTotal = parseFloat(metaInsights?.impressions || 0);
        const cpm = impressionsTotal > 0 ? (spendTotal / impressionsTotal * 1000).toFixed(2) : "0.00";
        const activeList = metaCampaignInsights.filter(c => c.effective_status === "ACTIVE");
        const maxActiveCtr = activeList.reduce((max, c) => {
          const ctr = parseFloat(c.insights?.inline_link_click_ctr || 0);
          return ctr > max ? ctr : max;
        }, 0);

        return (
          <EditorialPage>
            <header style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 11.5, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500, marginBottom: 10 }}>
                Meta Ads
              </div>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.8px", color: "var(--text)", margin: 0 }}>
                Overview
              </h1>
            </header>

            <EditorialStatRibbon columns={4}>
              <EditorialStatCell isFirst value={totalCampaignsRendered} label="Live campaigns" sub="Meta Ads API" />
              <EditorialStatCell value={sbRows.length} label="Reports" sub="Available reports" />
              <EditorialStatCell value={pendingAuthCount} label="Pending approval" sub={pendingAuthCount > 0 ? "Action needed" : "All clear"} accent={pendingAuthCount > 0 ? "danger" : "default"} />
              <EditorialStatCell isLast value={pausedCampaigns} label="Stopped" sub="Paused in Meta" accent="muted" />
            </EditorialStatRibbon>

            <section style={{ marginTop: 48 }}>
              <EditorialSectionHeader title="Account Health Snapshot" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: "1px solid var(--border)" }}>
                <EditorialPanelStatCell isFirst label="Total investment" value={`$${spendTotal.toFixed(2)}`} />
                <EditorialPanelStatCell label="Total reach" value={impressionsTotal.toLocaleString()} />
                <EditorialPanelStatCell isLast label="Avg CPM" value={`$${cpm}`} />
              </div>
            </section>

            <section style={{ marginTop: 48 }}>
              <EditorialSectionHeader title="Top Performing Campaign" meta={topPerformer ? `Objective · ${(topPerformer.objective || "link clicks").replace(/_/g, " ").toLowerCase()}` : "No data"} />
              {topPerformer ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, padding: "24px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--primary)", letterSpacing: "-0.3px" }}>{topPerformer.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Best CTR across live campaigns</div>
                  </div>
                  <div style={{ display: "flex", gap: 40, textAlign: "right" }}>
                    <EditorialMetricItem label="Spend" value={`$${parseFloat(topPerformer.insights?.spend || 0).toFixed(2)}`} />
                    <EditorialMetricItem label="CTR (link)" value={`${parseFloat(topPerformer.insights?.inline_link_click_ctr || 0).toFixed(2)}%`} accent="danger" />
                    <EditorialMetricItem label="Conversions" value={topPerformer.insights?.leads || 0} />
                  </div>
                </div>
              ) : (
                <p style={{ padding: "24px 0", margin: 0, fontSize: 14, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>No campaigns are currently tracking performance data.</p>
              )}
            </section>

            <section style={{ marginTop: 48 }}>
              <EditorialSectionHeader title="Live Campaigns" meta={`${activeCampaigns} active`} />
              {metaReportsLoading && metaCampaignInsights.length === 0 ? (
                <div style={{ padding: "32px 0", display: "flex", justifyContent: "center" }}><Spinner size={20} /></div>
              ) : activeList.length === 0 ? (
                <p style={{ padding: "24px 0", margin: 0, fontSize: 14, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>No live campaigns are currently running.</p>
              ) : (
                <div>
                  {activeList.map((c) => {
                    const ins = c.insights || {};
                    const ctr = parseFloat(ins.inline_link_click_ctr || 0);
                    const ctrHighlight = maxActiveCtr > 0 && ctr === maxActiveCtr;
                    return (
                      <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 40, padding: "22px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                        <div>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--primary)" }}>{c.name}</div>
                          <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 3 }}>{(c.objective || "link clicks").replace(/_/g, " ").toLowerCase()}</div>
                        </div>
                        <div style={{ display: "flex", gap: 36 }}>
                          <EditorialMetricItem size="sm" label="Spend" value={`$${parseFloat(ins.spend || 0).toFixed(2)}`} />
                          <EditorialMetricItem size="sm" label="CTR (link)" value={`${ctr.toFixed(2)}%`} accent={ctrHighlight ? "danger" : "default"} />
                          <EditorialMetricItem size="sm" label="Conv." value={ins.leads || 0} />
                        </div>
                        <EditorialStatusPill variant="active">Active</EditorialStatusPill>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.3</div>
          </EditorialPage>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          ADS ANALYSIS
      ═══════════════════════════════════════════════════════ */}
      {tab === "analysis" && (
        <EditorialPage>
          <EditorialPageHeader
            eyebrow="Configuration"
            title="Competitor Ad Analysis"
            subtitle="Research competitor ads, find gaps, and get ready-to-use ad scripts powered by AI."
          />

          <EditorialTabBar
            tabs={[
              { id: "analysis", label: "Analysis" },
              { id: "pastRuns", label: "Past runs", count: sbRows.length },
            ]}
            activeId={adsLabView}
            onChange={(id) => setAdsLabView(id as typeof adsLabView)}
          />

          {adsLabView === "analysis" && (
          <div>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes radar-sweep {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes radar-pulse {
                0% { transform: scale(0.6); opacity: 0.8; }
                100% { transform: scale(2.2); opacity: 0; }
              }
              @keyframes blip-glow {
                0%, 100% { transform: scale(0.8); opacity: 0.4; }
                50% { transform: scale(1.3); opacity: 1; filter: drop-shadow(0 0 4px var(--primary)); }
              }
            `}} />
            <section>
              <div style={{ fontSize: 11.5, letterSpacing: "1.6px", textTransform: "uppercase", color: "#C1121F", fontWeight: 700, padding: "28px 0 14px" }}>
                Topic for Analysis
              </div>
              <EditorialDefinitionList>
                <EditorialDefinitionRow label="Keywords" labelSub="Press Enter to append">
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap", marginBottom: 14 }}>
                    <input
                      type="text"
                      placeholder="Add a new keyword…"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = keywordInput.trim();
                          if (val && !researchKeywords.includes(val)) {
                            setResearchKeywords(prev => [...prev, val]);
                            setKeywordInput("");
                          }
                        }
                      }}
                      style={{
                        flex: 1,
                        minWidth: 200,
                        maxWidth: 320,
                        fontFamily: "inherit",
                        fontSize: 14.5,
                        padding: "8px 0 8px 8px",
                        border: "none",
                        borderBottom: "1px solid #C2B79A",
                        background: "transparent",
                        color: "var(--primary)",
                        outline: "none",
                      }}
                    />
                    <EditorialTextLink
                      onClick={() => {
                        const val = keywordInput.trim();
                        if (val && !researchKeywords.includes(val)) {
                          setResearchKeywords(prev => [...prev, val]);
                          setKeywordInput("");
                        }
                      }}
                    >
                      Add
                    </EditorialTextLink>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {researchKeywords.map((kw, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "5px 12px",
                          border: "1px solid #C2B79A",
                          borderRadius: 999,
                          color: "#2B3A4A",
                          fontSize: 13.5,
                        }}
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => setResearchKeywords(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: "none", border: "none", color: "#8C8474", fontWeight: 700, cursor: "pointer", padding: 0 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {researchKeywords.length === 0 && (
                      <span style={{ fontSize: 13, color: "var(--text-dim)" }}>No keywords selected.</span>
                    )}
                  </div>
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Locations">
                  <div style={{ position: "relative" }} onMouseLeave={() => setShowLocationDropdown(false)}>
                    <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap", marginBottom: 14 }}>
                      <input
                        type="text"
                        placeholder="Add country"
                        value={locationSearchInput}
                        onChange={(e) => {
                          setLocationSearchInput(e.target.value);
                          setShowLocationDropdown(true);
                        }}
                        onFocus={() => setShowLocationDropdown(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addResearchCountryFromInput();
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          maxWidth: 320,
                          fontFamily: "inherit",
                          fontSize: 14.5,
                          padding: "8px 0 8px 8px",
                          border: "none",
                          borderBottom: "1px solid #C2B79A",
                          background: "transparent",
                          color: "var(--primary)",
                          outline: "none",
                        }}
                      />
                      <EditorialTextLink onClick={addResearchCountryFromInput}>Add</EditorialTextLink>
                    </div>
                    {showLocationDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: 36,
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          background: "var(--card-bg)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          boxShadow: "var(--shadow-lg)",
                          maxHeight: 280,
                          overflowY: "auto",
                        }}
                      >
                        {filterCountryOptions(locationSearchInput).map((item) => (
                          <div
                            key={item.shortcut}
                            onClick={() => {
                              if (!researchCountries.includes(item.shortcut)) {
                                setResearchCountries((prev) => [...prev, item.shortcut]);
                              }
                              setLocationSearchInput("");
                              setShowLocationDropdown(false);
                            }}
                            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}
                          >
                            {item.name} ({item.shortcut})
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {researchCountries.map((code) => {
                        const matched = META_AD_LIBRARY_COUNTRIES.find((c) => c.shortcut === code);
                        const label = matched ? matched.name : code;
                        return (
                          <span
                            key={code}
                            style={{
                              border: "1px solid #C2B79A",
                              borderRadius: 999,
                              padding: "5px 12px",
                              fontSize: 13.5,
                              color: "#2B3A4A",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                            }}
                          >
                            {label} ({code})
                            <button
                              type="button"
                              onClick={() => setResearchCountries((prev) => prev.filter((c) => c !== code))}
                              style={{ background: "none", border: "none", color: "#8C8474", fontWeight: 700, cursor: "pointer", padding: 0 }}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                      {researchCountries.length === 0 && (
                        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>No locations selected.</span>
                      )}
                    </div>
                  </div>
                </EditorialDefinitionRow>

                <EditorialDefinitionRow label="Parameters" isLast>
                  <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Max ads</div>
                      <input
                        type="number"
                        value={researchMaxAds}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (e.target.value === "") { setResearchMaxAds(""); return; }
                          setResearchMaxAds(Math.min(100, Math.max(1, val)));
                        }}
                        min={1}
                        max={100}
                        style={{ fontFamily: "inherit", fontSize: 15, padding: "6px 0 6px 8px", border: "none", borderBottom: "1px solid #C2B79A", background: "transparent", color: "var(--primary)", outline: "none", width: 64 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Ad formats</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "6px 0" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={researchScrapeImage}
                            onChange={(e) => setResearchScrapeImage(e.target.checked)}
                            style={{ accentColor: "var(--red)", width: 15, height: 15 }}
                          />
                          Image
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={researchScrapeVideo}
                            onChange={(e) => setResearchScrapeVideo(e.target.checked)}
                            style={{ accentColor: "var(--red)", width: 15, height: 15 }}
                          />
                          Video
                        </label>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Only active ads</div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, cursor: "pointer", padding: "6px 0" }}>
                        <input type="checkbox" checked={researchOnlyActive} onChange={(e) => setResearchOnlyActive(e.target.checked)} style={{ accentColor: "var(--red)", width: 15, height: 15 }} />
                        Active only
                      </label>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Sort</div>
                      <div style={{ fontSize: 15, padding: "6px 0", display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
                        {formatResearchSortDisplay(researchSort)}
                        <button
                          type="button"
                          onClick={() => setResearchSort((prev) => (prev === "Impressions High → Low" ? "Newest First" : "Impressions High → Low"))}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            fontFamily: "inherit",
                            fontSize: 12.5,
                            color: "#8C8474",
                            borderBottom: "1px solid #C2B79A",
                            cursor: "pointer",
                          }}
                        >
                          change
                        </button>
                      </div>
                    </div>
                  </div>
                </EditorialDefinitionRow>
              </EditorialDefinitionList>

              {/* IDLE / DONE / ERROR STATE: TRIGGER BUTTON */}
              {(analysisStatus === "idle" || analysisStatus === "done" || analysisStatus === "error") && (
                <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px 0 0" }}>
                  <EditorialPillButton
                    variant="danger"
                    onClick={runCompetitorAnalysis}
                    disabled={integrationsConfigured !== true}
                    style={{ padding: "10px 24px", whiteSpace: "nowrap" }}
                  >
                    {analysisStatus === "done" ? "Re-run competitor analysis" : "Run competitor analysis"}
                  </EditorialPillButton>
                </div>
                {integrationsConfigured === false && (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                    Configure API keys in Settings before running competitor analysis.
                  </p>
                )}
                {analysisStatus === "error" && (
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--red)", textAlign: "right" }}>
                    {analysisError || webhookError || "Could not complete competitor analysis."}
                  </p>
                )}
                </>
              )}

              {/* ANALYSIS PROGRESS BAR */}
              {analysisStatus === "generating" && (
                <div className="animate-fade-in" style={{
                  background: "#fff", borderRadius: 14, border: "1.5px solid #C2D6E2",
                  padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,48,73,0.08)"
                }}>
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E7F0F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Spinner size={16} color="#003049" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#003049" }}>Competitor Analysis Running</div>
                        <div style={{ fontSize: 11, color: "#8C8474", marginTop: 1 }}>{analysisStatusMessage}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#003049" }}>{analysisProgress}%</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 8, background: "#E8DCC2", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${analysisProgress}%`,
                      background: "linear-gradient(90deg, #003049, #0ea5e9)",
                      borderRadius: 8,
                      transition: "width 1.8s ease-out",
                      boxShadow: "0 0 8px rgba(0,48,73,0.4)"
                    }} />
                  </div>

                  {/* Step indicators */}
                  <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                    {ANALYSIS_PIPELINE_PHASES.map((phase, i) => {
                      const isDone = analysisPhaseIndex > i;
                      const isActive = analysisPhaseIndex === i;
                      return (
                      <div key={phase.label} style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: isDone || isActive ? "#E7F0F6" : "#FDF6E3",
                        color: isDone || isActive ? "#1A4A66" : "#9FA8A3",
                        border: `1px solid ${isDone || isActive ? "#C2D6E2" : "#E8DCC2"}`,
                        transition: "all 0.5s"
                      }}>
                        <span>{isDone ? "✓" : isActive ? "●" : "○"}</span>
                        {phase.label}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* ── RESULTS ── */}
            {analysisStatus === "done" && analysisData && (
              <section className="animate-slide-up" style={{ marginTop: 48 }}>
                <EditorialSectionHeader
                  title={
                    <>
                      Analysis Summary
                      {analysisLastRunLabel ? (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontWeight: 600,
                            textTransform: "none",
                            letterSpacing: "0.02em",
                            marginLeft: 6,
                          }}
                        >
                          ( Last run · {analysisLastRunLabel} )
                        </span>
                      ) : null}
                    </>
                  }
                  meta={
                    hasAnalysisResultCards ? (
                      <EditorialTextLink onClick={toggleAllAnalysisSections}>
                        {allAnalysisSectionsExpanded ? "Collapse All" : "Expand All"}
                      </EditorialTextLink>
                    ) : undefined
                  }
                />

                {analysisData?.executive_summary && (
                  <p style={{ margin: 0, padding: "24px 0", fontSize: 16, lineHeight: 1.65, color: "#23394A", textWrap: "pretty", borderBottom: "1px solid #E8DCC2" }}>
                    {analysisData.executive_summary}
                  </p>
                )}

                {(analysisData?.competitors_table?.length > 0) && (
                  <>
                    <AnalysisSummaryNavRow
                      title="Competitor Ads"
                      subtitle={`${analysisData.competitors_table.length} competitors tracked`}
                      expanded={analysisCardsExpanded.competitors}
                      onClick={() => toggleAnalysisSection("competitors")}
                    />
                    {analysisCardsExpanded.competitors && (
                      <AnalysisDetailPanel>
                        {analysisData.competitors_table.map((row: any, i: number) => (
                          <AnalysisDetailRow
                            key={i}
                            label={<>{String(i + 1).padStart(2, "0")}</>}
                            meta={<AnalysisScoreMeta value={row?.score ?? "—"} />}
                            isLast={i === analysisData.competitors_table.length - 1}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--primary)" }}>{row?.name}</span>
                              {row?.ads != null && <AnalysisKeywordChip>{row.ads} ads</AnalysisKeywordChip>}
                              {row?.threat && (
                                <EditorialStatusPill variant={analysisThreatVariant(row.threat)}>{row.threat}</EditorialStatusPill>
                              )}
                            </div>
                            {row?.angle && (
                              <div style={{ marginBottom: row?.hook ? 6 : 0 }}>
                                <span style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Angle · </span>
                                {row.angle}
                              </div>
                            )}
                            {row?.hook && (
                              <div style={{ fontSize: 14, color: "var(--primary)", fontStyle: "italic", lineHeight: 1.55, paddingLeft: 12, borderLeft: "2px solid #C2B79A" }}>
                                &ldquo;{row.hook}&rdquo;
                              </div>
                            )}
                          </AnalysisDetailRow>
                        ))}
                      </AnalysisDetailPanel>
                    )}
                  </>
                )}

                {(analysisData?.hooks_table?.length > 0) && (
                  <>
                    <AnalysisSummaryNavRow
                      title="Top Hook Patterns"
                      subtitle="Winning formulas from competitor ads"
                      expanded={analysisCardsExpanded.hooks}
                      onClick={() => toggleAnalysisSection("hooks")}
                    />
                    {analysisCardsExpanded.hooks && (
                      <AnalysisDetailPanel>
                        {analysisData.hooks_table.map((row: any, i: number) => (
                          <AnalysisDetailRow
                            key={i}
                            label={<>{String(i + 1).padStart(2, "0")}</>}
                            meta={<AnalysisScoreMeta value={row?.score ?? "—"} />}
                            isLast={i === analysisData.hooks_table.length - 1}
                          >
                            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--primary)", marginBottom: 8 }}>
                              {row?.pattern}
                            </div>
                            {row?.example && (
                              <div style={{ fontSize: 14, color: "var(--primary)", fontStyle: "italic", lineHeight: 1.55, marginBottom: row?.reason ? 8 : 0, paddingLeft: 12, borderLeft: "2px solid #C2B79A" }}>
                                &ldquo;{row.example}&rdquo;
                              </div>
                            )}
                            {row?.reason && <div style={{ color: "#6B7A6E" }}>{row.reason}</div>}
                          </AnalysisDetailRow>
                        ))}
                      </AnalysisDetailPanel>
                    )}
                  </>
                )}

                {(analysisData?.market_insights_table?.length > 0) && (
                  <>
                    <AnalysisSummaryNavRow
                      title="Market Insights"
                      subtitle="Formats, angles & spend distribution"
                      expanded={analysisCardsExpanded.market_insights}
                      onClick={() => toggleAnalysisSection("market_insights")}
                    />
                    {analysisCardsExpanded.market_insights && (
                      <AnalysisDetailPanel>
                        {analysisData.market_insights_table.map((row: any, i: number) => (
                          <AnalysisDetailRow
                            key={i}
                            variant="field"
                            label={row?.field}
                            isLast={i === analysisData.market_insights_table.length - 1}
                          >
                            {row?.value}
                          </AnalysisDetailRow>
                        ))}
                      </AnalysisDetailPanel>
                    )}
                  </>
                )}

                {(analysisData?.gaps_table?.length > 0) && (
                  <>
                    <AnalysisSummaryNavRow
                      title="Gap Opportunities"
                      subtitle={`${analysisData.gaps_table.length} opportunities identified`}
                      expanded={analysisCardsExpanded.gaps}
                      onClick={() => toggleAnalysisSection("gaps")}
                    />
                    {analysisCardsExpanded.gaps && (
                      <AnalysisDetailPanel>
                        {analysisData.gaps_table.map((row: any, i: number) => (
                          <AnalysisDetailRow
                            key={i}
                            label={<>{String(i + 1).padStart(2, "0")}</>}
                            meta={row?.priority ? <EditorialStatusPill variant={analysisPriorityVariant(row.priority)}>{row.priority}</EditorialStatusPill> : undefined}
                            isLast={i === analysisData.gaps_table.length - 1}
                          >
                            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--primary)", marginBottom: row?.opportunity || row?.impact ? 8 : 0 }}>
                              {row?.gap}
                            </div>
                            {row?.opportunity && <div style={{ marginBottom: row?.impact ? 8 : 0 }}>{row.opportunity}</div>}
                            {row?.impact && (
                              <div style={{ fontSize: 13, color: "#6B7A6E", paddingLeft: 12, borderLeft: "2px solid var(--red)" }}>
                                {row.impact}
                              </div>
                            )}
                          </AnalysisDetailRow>
                        ))}
                      </AnalysisDetailPanel>
                    )}
                  </>
                )}

                {(!analysisData?.competitors_table?.length &&
                  !analysisData?.hooks_table?.length &&
                  !analysisData?.market_insights_table?.length &&
                  !analysisData?.gaps_table?.length &&
                  !analysisData?.message?.toLowerCase().includes("workflow")) && (
                    <>
                      <AnalysisSummaryNavRow
                        title="Raw Analysis Response"
                        subtitle="No structured table data found"
                        expanded={analysisCardsExpanded.raw}
                        onClick={() => toggleAnalysisSection("raw")}
                      />
                      {analysisCardsExpanded.raw && (
                        <AnalysisDetailPanel>
                          <div style={{ padding: "16px 0" }}>
                            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.6 }}>
                              Analysis completed but no structured table data was found.
                            </div>
                            <pre style={{
                              fontSize: 12,
                              background: "transparent",
                              borderTop: "1px solid var(--border)",
                              padding: "16px 0 0",
                              overflow: "auto",
                              maxHeight: 300,
                              margin: 0,
                              color: "var(--text-body)",
                              lineHeight: 1.6,
                              fontFamily: "var(--font-sans)",
                            }}>
                              {JSON.stringify(analysisData, null, 2)}
                            </pre>
                          </div>
                        </AnalysisDetailPanel>
                      )}
                    </>
                  )}

              </section>
            )}
          </div>
          )}

          {adsLabView === "pastRuns" && (
          <div
            id="past-runs-section"
            style={{
              background: "#fff", border: "1px solid #E8DCC2",
              borderRadius: 20, overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ padding: "14px 20px", background: "#FDF6E3", borderBottom: "1px solid #E8DCC2", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#E7F0F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>🕐</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#23394A" }}>Past Runs</div>
                <div style={{ fontSize: 11, color: "#9FA8A3", marginTop: 1 }}>{sbRows.length} saved {sbRows.length === 1 ? "result" : "results"}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: "70vh", overflowY: "auto" }}>
              {[...sbRows].map((row: any, idx: number) => {
                const report = parseSbReport(row);
                const inputsObj = typeof row.inputs === 'string' ? JSON.parse(row.inputs || "{}") : (row.inputs || {});
                const keyword = inputsObj.topic || (inputsObj.keywords && inputsObj.keywords[0]) || inputsObj.action || inputsObj.query || null;
                const displayTitle = keyword || report.topic || `Run at ${formatSbTime(row.created_at)}`;

                return (
                  <div key={row.id} style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #FDF0D5",
                    transition: "background 0.15s",
                    cursor: "default"
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: "#E7F0F6", color: "#003049", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        {sbRows.length - idx}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#23394A", lineHeight: 1.35, textTransform: "capitalize", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                        {displayTitle}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#9FA8A3", marginBottom: 10, display: "flex", alignItems: "center", gap: 5, paddingLeft: 32 }}>
                      <span>📅</span> {formatSbDate(row.created_at)}
                    </div>
                    <div style={{ paddingLeft: 32 }}>
                      <button
                        onClick={() => {
                          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                          setHoveredInputs(null);
                          freshAnalysisResultRef.current = false;
                          expandTopicCollapseResults();
                          setAnalysisData({ ...report, id: row.id });
                          setAnalysisStatus("done");
                          setSelectedTopic(report.topic || TOPICS[1]);
                          setAdsLabView("analysis");
                          addSbToast("Loaded history: " + report.topic);
                        }}
                        style={{
                          width: "100%", padding: "8px 0", borderRadius: 10, border: "none",
                          background: "#003049", color: "#fff",
                          fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#1A4A66";
                          if (row.inputs) {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            positionPastRunHoverPopup(e.clientX, e.clientY, inputsObj);
                          }
                        }}
                        onMouseMove={(e) => {
                          if (row.inputs) {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            positionPastRunHoverPopup(e.clientX, e.clientY, inputsObj);
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#003049";
                          hoverTimeoutRef.current = setTimeout(() => setHoveredInputs(null), 200);
                        }}
                      >
                        Use Result →
                      </button>
                    </div>
                  </div>
                );
              })}
              {sbRows.length === 0 && (
                <div style={{ padding: "32px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#8C8474" }}>No runs yet</div>
                  <div style={{ fontSize: 11, color: "#9FA8A3", marginTop: 4 }}>Your analysis history will appear here</div>
                </div>
              )}
            </div>
          </div>
          )}
          <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.3</div>
        </EditorialPage>
      )}

      {/* ═══════════════════════════════════════════════════════
          ADS LIBRARY — stay mounted so an in-flight scrape keeps polling
          when the user switches tabs/modules (hidden, not unmounted).
      ═══════════════════════════════════════════════════════ */}
      <div style={{ display: tab === "ads_library" ? "block" : "none" }} aria-hidden={tab !== "ads_library"}>
        <AdsLibrary />
      </div>

      {/* ═══════════════════════════════════════════════════════
          CREATE AD
      ═══════════════════════════════════════════════════════ */}
      {tab === "create" && (
        <EditorialPage wide>
          <EditorialPageHeader eyebrow="Meta Ads" title="Create Ad" />
          {createAdGenerationBusy && (
            <CreateAdProgressPanel
              statusLabel={
                createAdBackgroundProgress >= 100
                  ? "Generation complete — check Ad Previews below"
                  : createAdBackgroundStatus
              }
              progress={createAdBackgroundProgress}
              hint={
                createAdBackgroundProgress >= 100
                  ? undefined
                  : "You can switch modules — this bar stays until generation finishes."
              }
            />
          )}
          {!analysisData && (
            <div
              style={{
                background: "var(--amber-light)",
                border: "0.5px solid var(--amber)",
                borderRadius: "var(--radius-md)",
                padding: 14,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "var(--amber)",
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                No competitor analysis yet
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--amber-dark)",
                }}
              >
                Run competitor analysis first so AI can create a
                better ad based on real data.
              </div>
            </div>
          )}

          {/* ── Executive Summary from Analysis ── */}
          {analysisData?.executive_summary ? (
            <section style={{ marginBottom: createTabConfigOpen ? 0 : 8 }}>
              <EditorialSectionHeader
                title="Competitor Analysis Summary"
                meta={(analysisData?.topic || pendingAnalysisTopic) ? `Topic · ${analysisData?.topic || pendingAnalysisTopic}` : undefined}
              />
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 40, padding: "24px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "#23394A", textWrap: "pretty" }}>
                  {analysisData.executive_summary}
                </p>
                {!createTabConfigOpen && (
                  <EditorialPillButton
                    variant="danger"
                    onClick={openCreateAdConfigFromAnalysis}
                    disabled={adStatus === "generating" || adStatus === "waiting" || !analysisData}
                    style={{ padding: "10px 24px", whiteSpace: "nowrap" }}
                  >
                    {adStatus === "generating" ? <><Spinner size={12} color="#fff" /> Sending…</> :
                      adStatus === "waiting" ? <><Spinner size={12} color="#fff" /> Generating…</> :
                        "Generate ad →"}
                  </EditorialPillButton>
                )}
              </div>
            </section>
          ) : (
            <section style={{ marginBottom: 24 }}>
              <EditorialSectionHeader title="Competitor Analysis Summary" />
              <div style={{ padding: "24px 0", borderBottom: "1px solid var(--border)", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>
                Run or load a competitor analysis from the Competitors tab to power your ad creation.
              </div>
            </section>
          )}

          {createTabConfigOpen && (
                <div className="animate-fade-in" style={{
                  borderTop: createTabConfigOpen && analysisData?.executive_summary ? "none" : "1px solid var(--border)",
                  marginBottom: 24,
                  overflow: "hidden",
                }}>
                  {/* ── AD CONFIG ── */}
                  <div className="create-ads-config-grid" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, padding: "20px 24px", maxWidth: "100%", boxSizing: "border-box" }}>
                    {createTabAdsConfig.items.map((item, idx) => {
                      const isVideo = item.type === "video";
                      const isCompleted = completedItemIds.includes(String(item.id));
                      const isError = doesSlotHaveError(item.id);
                      // Not-started: has prompts, not completed, not errored, generation ended
                      // Not started: has prompts but generation ended with errors (even if nothing completed yet)
                      const generationEverRan = completedItemIds.length > 0 || (failedPrompts as any[]).length > 0;
                      const isNotStarted = !isCompleted && !isError && !generationActive && generationEverRan && !!adScenesMap[item.id]?.length;
                      // Hide completed cards — they're done
                      if (isCompleted) return null;
                      return (
                        <div key={item.id} style={{
                          borderRadius: 14,
                          background: "#fff",
                          border: isError ? "2px solid #C1121F" : isVideo ? "1.5px solid #C2D6E2" : "1.5px solid #E8DCC2",
                          overflow: "hidden",
                          boxShadow: isError ? "0 4px 20px rgba(239,68,68,0.12)" : "0 2px 12px rgba(0,0,0,0.06)",
                          width: "100%", maxWidth: 680, boxSizing: "border-box",
                        }}>
                          {/* Config card header */}
                          <div style={{
                            padding: "12px 18px",
                            background: isError ? "linear-gradient(135deg, #F9E3E0, #fee2e2)"
                              : isNotStarted ? "linear-gradient(135deg, #fffbeb, #fef3c7)"
                              : isVideo ? "linear-gradient(135deg, #E7F0F6, #C2D6E2)" : "linear-gradient(135deg, #FDF6E3, #FDF0D5)",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                            borderBottom: isError ? "1.5px solid #fecaca" : isNotStarted ? "1.5px solid #fde68a" : isVideo ? "1.5px solid #C2D6E2" : "1.5px solid #E8DCC2"
                          }}>
                            {/* Left: icon + label */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: isError ? "#fee2e2" : isNotStarted ? "#fef3c7" : isVideo ? "#C2D6E2" : "#E8DCC2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                                {isError ? "⚠️" : isNotStarted ? "⏸" : isVideo ? "🎬" : "🖼️"}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: isError ? "#C1121F" : isNotStarted ? "#92400e" : isVideo ? "#1A4A66" : "#4A5A64" }}>
                                  {isVideo ? "Video" : "Image"} Ad
                                </div>
                                <div style={{ fontSize: 10, color: isError ? "#C1121F" : isNotStarted ? "#d97706" : isVideo ? "#669BBC" : "#9FA8A3", marginTop: 1, fontWeight: 600 }}>
                                  {isError ? "Failed — click to fix" : isNotStarted ? "Not started — pending retry" : "Configuration"}
                                </div>
                              </div>
                            </div>
                            {/* Right: toggle + reset */}
                            {!isError && !isNotStarted && (() => {
                              const toggleLocked = !!adScenesMap[item.id]?.length || !!sentIdeaIds[item.id] || adStatus === "generating" || generationActive;
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                  {/* Reset button */}
                                  <button
                                    type="button"
                                    onClick={() => resetCreateTabWorkspace()}
                                    title="Reset and start over"
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #E8DCC2", background: "#FDF6E3", color: "#8C8474", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                  >↺ Reset</button>
                                  {/* Video / Image toggle */}
                                  <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1.5px solid #E8DCC2", opacity: toggleLocked ? 0.45 : 1 }}
                                    title={toggleLocked ? "Locked while generating" : undefined}>
                                    <button type="button"
                                      onClick={() => !toggleLocked && setCreateTabItemType(idx, "video")}
                                      style={{ padding: "6px 14px", border: "none", fontSize: 12, fontWeight: 700, cursor: toggleLocked ? "not-allowed" : "pointer", background: isVideo ? "#003049" : "#FDF0D5", color: isVideo ? "#fff" : "#8C8474", transition: "all 0.15s" }}
                                    >🎬 Video</button>
                                    <div style={{ width: 1, background: "#E8DCC2" }} />
                                    <button type="button"
                                      onClick={() => !toggleLocked && setCreateTabItemType(idx, "image")}
                                      style={{ padding: "6px 14px", border: "none", fontSize: 12, fontWeight: 700, cursor: toggleLocked ? "not-allowed" : "pointer", background: !isVideo ? "#003049" : "#FDF0D5", color: !isVideo ? "#fff" : "#8C8474", transition: "all 0.15s" }}
                                    >🖼️ Image</button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <div style={{ padding: 20, maxWidth: "100%", boxSizing: "border-box", overflowX: "hidden" }}>

                          {isVideo ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                              <div className="config-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#8C8474", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Duration</div>
                                  <CustomSelect
                                    value={item.duration}
                                    onChange={(v) => updateCreateTabItemField(idx, "duration", v)}
                                    options={DURATIONS.map(d => ({ value: d, label: d }))}
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#8C8474", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Audio Style</div>
                                  <CustomSelect
                                    value={item.audioStyle}
                                    onChange={(v) => updateCreateTabItemField(idx, "audioStyle", v)}
                                    options={AUDIO_STYLES.map(a => ({ value: a, label: a }))}
                                  />
                                </div>
                              </div>
                              <div className="config-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minWidth: 0 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#8C8474", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Character</div>
                                  <CustomSelect
                                    value={item.character || "male"}
                                    onChange={(v) => {
                                      setCreateTabAdsConfig((prev) => {
                                        const newItems = [...prev.items];
                                        newItems[idx] = { ...newItems[idx], character: v };
                                        return { ...prev, items: newItems };
                                      });
                                    }}
                                    options={[{ value: "male", label: "👨 Male" }, { value: "female", label: "👩 Female" }]}
                                  />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#8C8474", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visual Style</div>
                                  <CustomSelect
                                    value={item.videoStyle}
                                    onChange={(v) => updateCreateTabItemField(idx, "videoStyle", v)}
                                    options={VIDEO_STYLES.map(s => ({ value: s, label: s }))}
                                  />
                                </div>
                              </div>
                              {item.audioStyle !== "Background Music" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#8C8474", marginBottom: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Voice</div>
                                <button
                                  type="button"
                                  onClick={() => setVoiceModalOpenForId(item.id)}
                                  style={{
                                    width: "100%", padding: "10px", borderRadius: "var(--radius-md)",
                                    border: voiceLabels[item.id] ? "none" : "2px dashed #669BBC",
                                    background: voiceLabels[item.id] ? "#003049" : "#E7F0F6", color: voiceLabels[item.id] ? "#fff" : "#003049",
                                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                    fontFamily: "inherit", transition: "all 0.15s",
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = voiceLabels[item.id] ? "#1A4A66" : "#C2D6E2"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = voiceLabels[item.id] ? "#003049" : "#E7F0F6"; }}
                                >
                                  🎙️ {voiceLabels[item.id] ? "Voice Selected" : "Select Voice *"}
                                </button>
                                {voiceLabels[item.id] && (
                                  <div style={{
                                    display: "flex", alignItems: "center", gap: 4, minWidth: 0,
                                    padding: "4px 8px", background: "#E7F0F6",
                                    border: "1px solid #C2D6E2", borderRadius: 6,
                                    overflow: "hidden",
                                  }}>
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, fontWeight: 600, color: "#1A4A66" }}>
                                      {voiceLabels[item.id]}
                                    </span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: "#003049", textTransform: "uppercase", background: "#C2D6E2", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>
                                      ✓
                                    </span>
                                  </div>
                                )}
                              </div>
                              )}
                              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                                <div style={{ width: "100%", maxWidth: 320 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#8C8474", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Language</div>
                                  <CustomSelect
                                    value={item.language || "English"}
                                    onChange={(v) => updateCreateTabItemField(idx, "language", v)}
                                    options={LANGUAGES.map(l => ({ value: l, label: l }))}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#8C8474", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visual Style</div>
                                <CustomSelect
                                  value={item.imageStyle || "Bold & Colorful"}
                                  onChange={(v) => updateCreateTabItemField(idx, "imageStyle", v)}
                                  options={VIDEO_STYLES.map(s => ({ value: s, label: s }))}
                                />
                              </div>
                            </div>
                          )}
                          <CreateAdParametersBlock
                            item={item}
                            idx={idx}
                            isVideo={isVideo}
                            analysisData={analysisData}
                            adStatus={adStatus}
                            adScenesGenerating={adScenesGenerating}
                            sentIdeaIds={sentIdeaIds}
                            generatedIdeas={generatedIdeas}
                            onUpdateAdParam={updateCreateTabItemAdParam}
                            onUpdateIdea={(i, v) => updateCreateTabItemField(i, "idea", v)}
                            onGenerateIdeas={handleGenerateCreateAdIdeas}
                            onClearGeneratedIdeas={(id) =>
                              setGeneratedIdeas((prev) => {
                                const updated = { ...prev };
                                delete updated[id];
                                return updated;
                              })
                            }
                          />
                          {/* ── View Image & Video Prompts button ── */}
                          {adScenesGenerating[item.id] ? (
                            <div style={{
                              marginTop: 16, padding: "13px 0", display: "flex", alignItems: "center",
                              justifyContent: "center", gap: 8, borderTop: "1.5px solid #E8DCC2",
                              color: isVideo ? "#003049" : "#b45309", fontSize: 12, fontWeight: 600,
                            }}>
                              <Spinner size={14} color={isVideo ? "#003049" : "#b45309"} />
                              {isVideo ? "Generating prompts… please wait" : "Generating image… please wait"}
                            </div>
                          ) : generationActive && !doesSlotHaveError(item.id) && adScenesMap[item.id]?.length > 0 ? (
                            <div style={{
                              marginTop: 16, padding: "13px 0", display: "flex", alignItems: "center",
                              justifyContent: "center", gap: 8, borderTop: "1.5px solid #bae6fd",
                              background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", borderRadius: "0 0 12px 12px",
                              color: "#003049", fontSize: 12, fontWeight: 700,
                            }}>
                              <Spinner size={13} color="#003049" />
                              Generating video…
                            </div>
                          ) : adScenesMap[item.id]?.length > 0 ? (
                            <button
                              onClick={() => {
                                const scenes = adScenesMap[item.id] || [];
                                setScenesModal({ open: true, scenes, adLabel: `${isVideo ? "Video" : "Image"} ${idx + 1}`, itemId: item.id });
                                setEditedScenes(JSON.parse(JSON.stringify(scenes)));
                              }}
                              style={{
                                marginTop: 16, width: "100%", padding: "13px 0", borderRadius: "var(--radius-md)",
                                border: "none", fontFamily: "inherit", cursor: "pointer",
                                background: doesSlotHaveError(item.id)
                                  ? "linear-gradient(135deg, #C1121F, #C1121F)"
                                  : isVideo ? "linear-gradient(135deg, #003049, #38bdf8)" : "linear-gradient(135deg, #b45309, #d97706)",
                                color: "#fff", fontSize: 12, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                boxShadow: doesSlotHaveError(item.id)
                                  ? "0 4px 12px rgba(220,38,38,0.40)"
                                  : isVideo ? "0 4px 12px rgba(2,132,199,0.35)" : "0 4px 12px rgba(217,119,6,0.35)",
                                transition: "transform 0.15s",
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                            >
                              {doesSlotHaveError(item.id)
                                ? "⚠️ Error — View All Prompts"
                                : <>🎬 View Image &amp; Video Prompts &nbsp;·&nbsp; {adScenesMap[item.id].length} scenes</>}
                            </button>
                          ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit / Status Area */}
                  <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #fffbeb 0%, #f0f9ff 100%)", borderTop: "1.5px solid #bae6fd" }}>
                    {(isStatusPolling || adStatus === "waiting") ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {!workflowStatus?.toLowerCase().includes("completed") && (
                          <div style={{ position: "relative", height: 2, background: "var(--primary-light)", borderRadius: 1, overflow: "hidden", marginBottom: 12 }}>
                            <div className="animate-pulse" style={{
                              position: "absolute", top: 0, left: 0, height: "100%", width: "30%",
                              background: "var(--primary)", borderRadius: 1,
                              animation: "scan 2s linear infinite"
                            }} />
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className={workflowStatus?.toLowerCase().includes("completed") ? "" : "animate-pulse"} style={{ width: 10, height: 10, borderRadius: "50%", background: workflowStatus?.toLowerCase().includes("completed") ? "var(--green)" : "var(--primary)" }} />
                            <SectionTitle style={{ marginBottom: 0 }}>{workflowStatus?.toLowerCase().includes("completed") ? "Workflow Completed" : "Workflow in Progress"}</SectionTitle>
                          </div>
                          {workflowStatus?.toLowerCase().includes("completed") ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Badge text="COMPLETED" color="var(--green)" bg="var(--green-light)" />
                              <button
                                type="button"
                                onClick={() => { setIsStatusPolling(false); resetCreateTabWorkspace(); setCreateTabConfigOpen(true); }}
                                style={{
                                  padding: "6px 14px", borderRadius: 8, border: "none",
                                  background: "linear-gradient(135deg, #003049, #0ea5e9)", color: "#fff",
                                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                                  boxShadow: "0 2px 8px rgba(2,132,199,0.3)"
                                }}
                              >+ Create New Ad</button>
                            </div>
                          ) : (
                            <Badge text="RUNNING" color="var(--primary)" bg="var(--primary-light)" />
                          )}
                        </div>

                        <div style={{ padding: "14px 18px", borderRadius: "var(--radius-md)", background: "var(--card-bg)", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Current Status</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: workflowStatus?.toLowerCase().includes("completed") ? "var(--green)" : "var(--primary)", display: "flex", alignItems: "center", gap: 8 }}>
                            {!workflowStatus?.toLowerCase().includes("completed") && <Spinner size={14} color="var(--primary)" />}
                            {workflowStatus || "Video is Generating..."}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
                            The ad pipeline is orchestrating image and video generation. Ad previews will refresh automatically upon completion.
                          </div>

                          {/* Image & Video Generation Progress Bars */}
                          {(() => {
                            const lStatus = workflowStatus?.toLowerCase() || "";

                            // Determine what to show based on status text or if we requested them
                            // Determine what to show based on status text and current configuration
                            const hasBoth = lStatus.includes("image/video");
                            const showImage = createTabAdsConfig.imageCount > 0 && (hasBoth || lStatus.includes("image") || lStatus.includes("triggering"));
                            const showVideo = createTabAdsConfig.videoCount > 0 && (hasBoth || lStatus.includes("video") || lStatus.includes("triggering") || !lStatus);

                            // Determine completion
                            const allDone = lStatus === "completed" || lStatus === "workflow completed";
                            const imgDone = allDone || lStatus.includes("image ad completed") || lStatus.includes("image completed");
                            const vidDone = allDone || lStatus.includes("video ad completed") || lStatus.includes("video completed");

                            if (!workflowStatus || workflowStatus === "waiting") return null;

                            return (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
                                {showImage && (
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", fontWeight: 600, marginBottom: 6 }}>
                                      <span>{imgDone ? "Image Generation Completed" : "Generating Image (~1:30)"}</span>
                                      <span>{imgDone ? "100%" : ""}</span>
                                    </div>
                                    <div style={{ position: "relative", height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                      <style>{`
                                            @keyframes fillImageGen {
                                              0% { width: 0%; }
                                              100% { width: 98%; }
                                            }
                                          `}</style>
                                      <div
                                        style={{
                                          position: "absolute", top: 0, left: 0, height: "100%",
                                          background: imgDone ? "var(--green)" : "var(--primary)",
                                          borderRadius: 3,
                                          width: imgDone ? "100%" : "0%",
                                          animation: !imgDone ? "fillImageGen 90s linear forwards" : "none",
                                          transition: "width 0.5s ease-out, background 0.5s"
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {showVideo && (
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)", fontWeight: 600, marginBottom: 6 }}>
                                      <span>{vidDone ? "Video Generation Completed" : "Generating Video (~10:00)"}</span>
                                      <span>{vidDone ? "100%" : ""}</span>
                                    </div>
                                    <div style={{ position: "relative", height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                      <style>{`
                                            @keyframes fillVideoGen {
                                              0% { width: 0%; }
                                              100% { width: 98%; }
                                            }
                                          `}</style>
                                      <div
                                        style={{
                                          position: "absolute", top: 0, left: 0, height: "100%",
                                          background: vidDone ? "var(--green)" : "var(--primary)",
                                          borderRadius: 3,
                                          width: vidDone ? "100%" : "0%",
                                          animation: !vidDone ? "fillVideoGen 600s linear forwards" : "none",
                                          transition: "width 0.5s ease-out, background 0.5s"
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                    {(() => {
                      const allIdeasFilled = (createTabAdsConfig.items || []).every((item: any) => item.idea?.trim());
                      const ideaGenerating = Object.values(sentIdeaIds).some(Boolean);

                      if (createAdGenerationBusy) {
                        return (
                          <div style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>
                            Ad generation in progress — see the progress bar above.
                          </div>
                        );
                      }

                      return (!allIdeasFilled || ideaGenerating) ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#92400e", fontSize: 13 }}>
                          <span style={{ fontSize: 16 }}>{ideaGenerating ? "⏳" : "✏️"}</span>
                          <span>{ideaGenerating ? <><Spinner size={12} color="#92400e" /> <b>Generating idea…</b> please wait before confirming.</> : <>Use <b>Prompt Parameters</b> to generate an idea, or fill in the prompt below for each ad.</>}</span>
                        </div>
                      ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>🚀</span>
                          <div style={{ fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                            <b>{createTabAdsConfig.items[0]?.type === "video" ? "🎬 Video" : "🖼️ Image"} Ad</b> ready
                          </div>
                        </div>

                        {adStatus === "generating" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 400 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#003049" }}>
                              <span><Spinner size={11} color="#003049" /> {createTabAdsConfig.items[0]?.type === "video" ? "Generating prompts…" : "Generating image…"}</span>
                              <span>{promptGenProgress}%</span>
                            </div>
                            <div style={{ height: 5, background: "#C2D6E2", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", background: "linear-gradient(90deg, #003049, #0ea5e9)", borderRadius: 3, width: `${promptGenProgress}%`, transition: "width 1.8s ease-out" }} />
                            </div>
                          </div>
                        ) : Object.values(adScenesMap).some(scenes => Array.isArray(scenes) && scenes.length > 0) ? (
                          (() => {
                            const errIds = new Set((failedPrompts as any[]).map((f: any) => String(f.itemId)).filter(Boolean));
                            const notStarted = (createTabAdsConfig.items || []).filter((it: any) =>
                              !completedItemIds.includes(String(it.id)) && !errIds.has(String(it.id))
                            );
                            const hasErrors = (failedPrompts as any[]).length > 0;
                            const hasRemaining = hasErrors || notStarted.length > 0;
                            const generationEverRan = completedItemIds.length > 0 || hasErrors;

                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                                {/* START AGAIN — when errors or not-started exist after generation ran */}
                                {!generationActive && generationEverRan && hasRemaining && (
                                  <button
                                    onClick={handleStartAgain}
                                    type="button"
                                    style={{
                                      padding: "12px 28px", borderRadius: "var(--radius-lg)", border: "none",
                                      background: "linear-gradient(135deg, #003049, #0ea5e9)", color: "#fff",
                                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                                      boxShadow: "0 4px 12px rgba(2,132,199,0.3)"
                                    }}
                                  >
                                    🔄 Start Again ({errIds.size + notStarted.length} ad{errIds.size + notStarted.length > 1 ? "s" : ""}) →
                                  </button>
                                )}

                                {/* ACCEPT PROMPTS — first time, no generation has happened yet */}
                                {!generationActive && !generationEverRan && (failedPrompts as any[]).length === 0 && (
                                  <button
                                    onClick={handleAcceptPrompts}
                                    disabled={acceptingPrompts}
                                    type="button"
                                    style={{
                                      padding: "12px 30px", borderRadius: "var(--radius-lg)", border: "none",
                                      background: acceptingPrompts ? "var(--primary-light)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                                      color: acceptingPrompts ? "var(--primary)" : "#fff",
                                      fontSize: 13, fontWeight: 700, cursor: acceptingPrompts ? "not-allowed" : "pointer",
                                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                                      opacity: acceptingPrompts ? 0.7 : 1,
                                      boxShadow: acceptingPrompts ? "none" : "0 4px 12px rgba(34, 197, 94, 0.3)"
                                    }}
                                  >
                                    {acceptingPrompts ? <><Spinner size={14} /> Accepting...</> : "Accept Prompts ✓"}
                                  </button>
                                )}
                              </div>
                            );
                          })()
                        ) : (() => {
                          const isImageAd = createTabAdsConfig.items[0]?.type === "image";
                          // IMAGE: show progress bar while generating
                          if (isImageAd && imageGenerating) return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 400 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#d97706" }}>
                                <span><Spinner size={11} color="#d97706" /> Generating image…</span>
                                <span>{imageGenProgress}%</span>
                              </div>
                              <div style={{ height: 5, background: "#fef3c7", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", background: "linear-gradient(90deg, #d97706, #f59e0b)", borderRadius: 3, width: `${imageGenProgress}%`, transition: "width 1.8s ease-out" }} />
                              </div>
                            </div>
                          );
                          // Confirm & Generate button
                          const locked = adStatus === "generating" || adStatus === "waiting" || !analysisData || imageGenerating;
                          return (
                            <button
                              onClick={isImageAd ? handleImageGenerate : handleCreateTabTriggerAds}
                              disabled={locked}
                              type="button"
                              className="w-full sm:w-auto"
                              style={{
                                padding: "12px 30px", borderRadius: "var(--radius-lg)", border: "none",
                                background: locked ? "var(--primary-light)" : isImageAd ? "linear-gradient(135deg, #d97706, #f59e0b)" : "linear-gradient(135deg, #003049, #0ea5e9)",
                                color: locked ? "var(--primary)" : "#fff",
                                fontSize: 13, fontWeight: 700, cursor: locked ? "not-allowed" : "pointer",
                                fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                                opacity: locked ? 0.7 : 1, transition: "transform 0.15s, box-shadow 0.15s",
                                boxShadow: locked ? "none" : `0 4px 12px ${isImageAd ? "rgba(217,119,6,0.3)" : "rgba(2,132,199,0.3)"}`
                              }}
                              onMouseEnter={(e) => { if (!locked) e.currentTarget.style.transform = "translateY(-1px)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                            >
                              {isImageAd ? "🖼️ Generate Image →" : "Confirm & Generate Ads →"}
                            </button>
                          );
                        })()}
                      </div>
                      );
                    })()}
                        </div>
                        {!generationActive && adStatus !== "generating" && adStatus !== "waiting" && !imageGenerating && (
                          <button
                            type="button"
                            onClick={closeCreateTabConfig}
                            style={{
                              padding: "10px 20px",
                              borderRadius: "var(--radius-md)",
                              border: "1.5px solid #E8DCC2",
                              background: "#fff",
                              color: "#8C8474",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              flexShrink: 0,
                              transition: "background 0.15s, border-color 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#FDF6E3";
                              e.currentTarget.style.borderColor = "#C2B79A";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#fff";
                              e.currentTarget.style.borderColor = "#E8DCC2";
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}


                    {adStatus === "error" && (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: "var(--radius-sm)", background: "var(--red-light)", color: "var(--red-strong)", fontSize: 12, border: "0.5px solid var(--red)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span><b>Error:</b> {webhookError || "Failed to generate ad prompts."}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAdStatus("idle");
                            setWebhookError("");
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--red-strong)",
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 800,
                            padding: "0 4px",
                            lineHeight: 1
                          }}
                          title="Dismiss Error"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
          )}

          {/* Errors are now shown inline on each card — no separate bottom panel needed */}

          {/* ── FAILED IMAGE PROMPTS PANEL ── */}
          {failedImagePrompts.length > 0 && (
            <div style={{ marginTop: 20, borderRadius: 16, overflow: "hidden", border: "2px solid #C1121F", boxShadow: "0 8px 32px rgba(220,38,38,0.18)" }}>
              {/* Header */}
              <div style={{ background: "linear-gradient(135deg, #C1121F, #C1121F)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Image Generation Failed</div>
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
                      {failedImagePrompts.length} prompt{failedImagePrompts.length > 1 ? "s" : ""} violated content policy — edit and resubmit
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setFailedImagePrompts([])}
                  style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 12px", fontSize: 12, fontWeight: 700 }}
                >
                  Dismiss
                </button>
              </div>
              {/* Failed prompt cards */}
              <div style={{ background: "#fff1f2", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {failedImagePrompts.map((fp, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1.5px solid #fca5a5", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ background: "#C1121F", color: "#fff", borderRadius: 8, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>
                          Image #{fp.index + 1}
                        </span>
                        <span style={{ color: "#C1121F", fontSize: 12, fontWeight: 600 }}>Policy Violation</span>
                      </div>
                      <button
                        onClick={() => setEditingImagePrompt({ open: true, index: fp.index, prompt: fp.prompt, reason: fp.reason })}
                        style={{ background: "linear-gradient(135deg, #003049, #669BBC)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "7px 16px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
                      >
                        ✏️ Edit &amp; Resubmit
                      </button>
                    </div>
                    <div style={{ background: "#fff1f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#780000", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Prompt</div>
                      <div style={{ fontSize: 13, color: "#23394A", lineHeight: 1.6, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{fp.prompt}</div>
                    </div>
                    <div style={{ background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🚫</span>
                      <div style={{ fontSize: 12, color: "#780000", lineHeight: 1.5 }}><b>Reason: </b>{fp.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AD PREVIEWS ── */}
          <section style={{ marginTop: 48 }}>
            <EditorialSectionHeader
              title="Ad Previews"
              meta={
                <EditorialTextLink onClick={handleRefreshAdVideos} disabled={adVideosLoading} style={{ fontSize: 13 }}>
                  {adVideosLoading ? "Refreshing…" : "Refresh previews"}
                </EditorialTextLink>
              }
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: "16px 0 8px", alignItems: "baseline" }}>
              {[
                { value: "all", label: "All" },
                { value: "video", label: "Videos" },
                { value: "image", label: "Images" },
              ].map((f) => {
                const active = previewMediaFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setPreviewMediaFilter(f.value)}
                    style={{
                      background: "none", border: "none", padding: "0 2px 4px", fontFamily: "inherit",
                      fontSize: 14, fontWeight: active ? 700 : 400, color: active ? "#C1121F" : "#4A5A64",
                      borderBottom: active ? "2px solid #C1121F" : "2px solid transparent", cursor: "pointer",
                      transition: "color 0.15s ease, border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (active) return;
                      e.currentTarget.style.color = "#003049";
                      e.currentTarget.style.borderBottomColor = "#C2B79A";
                    }}
                    onMouseLeave={(e) => {
                      if (active) return;
                      e.currentTarget.style.color = "#4A5A64";
                      e.currentTarget.style.borderBottomColor = "transparent";
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
              <div style={{ marginLeft: "auto", display: "flex", gap: 24, alignItems: "baseline" }}>
                {[
                  { value: "approved", label: "Approved" },
                  { value: "unapproved", label: "Unapproved" },
                ].map((f) => {
                  const active = previewStatusFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setPreviewStatusFilter(active ? "" : f.value)}
                      style={{
                        background: "none", border: "none", padding: "0 2px 4px", fontFamily: "inherit",
                        fontSize: 14, fontWeight: active ? 700 : 400, color: active ? "#C1121F" : "#4A5A64",
                        borderBottom: active ? "2px solid #C1121F" : "2px solid transparent", cursor: "pointer",
                        transition: "color 0.15s ease, border-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (active) return;
                        e.currentTarget.style.color = "#003049";
                        e.currentTarget.style.borderBottomColor = "#C2B79A";
                      }}
                      onMouseLeave={(e) => {
                        if (active) return;
                        e.currentTarget.style.color = "#4A5A64";
                        e.currentTarget.style.borderBottomColor = "transparent";
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const filteredPreviewAds = allPreviewAds.filter((ad) => {
                const isVideo = (ad.format || "").toLowerCase() === "video";
                if (previewMediaFilter === "video" && !isVideo) return false;
                if (previewMediaFilter === "image" && isVideo) return false;
                if (previewStatusFilter === "approved" && !isAdApproved(ad.Approved)) return false;
                if (previewStatusFilter === "unapproved" && isAdApproved(ad.Approved)) return false;
                return true;
              });

              if (filteredPreviewAds.length === 0) {
                return (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14, borderTop: "1px solid var(--border)" }}>
                    No ads match the current filters.
                  </div>
                );
              }

              const linkStyle = (extra: CSSProperties = {}) => ({
                background: "none", border: "none", padding: 0, fontFamily: "inherit", cursor: "pointer", ...extra,
              });

              const previewActionLink = (
                label: string,
                onClick: () => void,
                opts: { disabled?: boolean; primary?: boolean; muted?: boolean; trailing?: boolean } = {}
              ) => {
                const { disabled = false, primary = false, muted = false, trailing = false } = opts;
                const baseColor = primary ? "#003049" : muted ? "#8C8474" : "#4A5A64";
                const hoverColor = primary || trailing ? "#C1121F" : muted ? "#C1121F" : "#003049";
                return (
                  <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    style={linkStyle({
                      fontSize: 13.5,
                      fontWeight: primary || trailing ? 700 : muted ? 400 : 700,
                      color: baseColor,
                      borderBottom: trailing || primary ? "1px solid #C2B79A" : "none",
                      marginLeft: trailing ? "auto" : undefined,
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition: "color 0.15s ease, border-color 0.15s ease",
                    })}
                    onMouseEnter={(e) => {
                      if (disabled) return;
                      e.currentTarget.style.color = hoverColor;
                      if (trailing || primary) e.currentTarget.style.borderBottomColor = "#C1121F";
                    }}
                    onMouseLeave={(e) => {
                      if (disabled) return;
                      e.currentTarget.style.color = baseColor;
                      if (trailing || primary) e.currentTarget.style.borderBottomColor = "#C2B79A";
                    }}
                  >
                    {label}
                  </button>
                );
              };

              return (
                <div className="editorial-preview-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 28, marginTop: 16 }}>
                  {filteredPreviewAds.map((latestEntry) => {
                    const url = latestEntry?.text || "";
                    const isVideo = (latestEntry?.format || "").toLowerCase() === "video";
                    const adKey = latestEntry?.id + "_" + latestEntry?.time;
                    const mediaMissing = missingMediaKeys.has(adKey);
                    const approved = isAdApproved(latestEntry?.Approved);
                    const id = String(latestEntry?.id || "Unknown");
                    const shortId = id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
                    const label = `${isVideo ? "Video ad" : "Image ad"} · ${shortId}`;
                    const markMediaMissing = () => {
                      setMissingMediaKeys((prev) => new Set(prev).add(adKey));
                    };

                    return (
                      <div key={adKey} style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #E8DCC2", paddingTop: 16 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                          <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474" }}>
                            {label}
                          </div>
                          <EditorialStatusPill variant={approved ? "approved" : "unapproved"}>
                            {approved ? "Approved" : "Unapproved"}
                          </EditorialStatusPill>
                        </div>
                        <CreateAdPreviewMedia
                          url={url}
                          isVideo={isVideo}
                          label={label}
                          mediaMissing={mediaMissing}
                          onMediaMissing={markMediaMissing}
                        />

                        <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginTop: 14, flexWrap: "wrap" }}>
                          {previewActionLink("Details", () => setSelectedAdForDetails(latestEntry), { disabled: !url })}
                          {mediaMissing
                            ? previewActionLink(
                                removingId === adKey ? "Removing…" : "Remove stale",
                                () => handleDeleteStaleAd(latestEntry),
                                { muted: true, disabled: removingId === adKey }
                              )
                            : previewActionLink(
                                removingId === adKey ? "Deleting…" : "Delete",
                                () => handleRemoveApprovedAd(latestEntry),
                                { muted: true, disabled: removingId === adKey }
                              )}
                          {approved && previewActionLink(
                            unapprovingId === adKey ? "Unapproving…" : "Unapprove",
                            () => handleUnapproveAd(latestEntry),
                            { muted: true, disabled: unapprovingId === adKey }
                          )}
                          {approved
                            ? previewActionLink("Send to setup", () => { setLaunchAdCandidate(latestEntry); setTab("campaigns"); }, { trailing: true })
                            : previewActionLink(
                                approvingId === adKey ? "Approving…" : "Approve",
                                () => handleApproveAd(latestEntry),
                                { trailing: true, primary: true, disabled: !url || mediaMissing || approvingId === adKey }
                              )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

              {/* ── CUSTOM MEDIA UPLOAD ── */}
              <div style={{
                marginTop: 48, padding: "32px 0", borderTop: "1px dashed var(--border)",
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12
              }}>
                <EditorialSectionHeader title="Or Upload Your Own Media" />
              <div style={{ fontSize: 13.5, color: "#8C8474", maxWidth: 480, lineHeight: 1.6 }}>
                Skip the AI generation and upload your own video or image. It will appear in Ad Previews below.
              </div>

              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <label style={{
                  padding: "10px 20px", borderRadius: "var(--radius-md)",
                  background: "var(--card-bg)", border: "1px solid var(--border)",
                  color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                  opacity: customUploadLoading ? 0.6 : 1
                }}>
                  {customUploadLoading ? (
                    <><Spinner size={14} color="var(--primary)" /> Uploading...</>
                  ) : (
                    <><span>+</span> Choose File to Upload</>
                  )}
                  <input
                    type="file"
                    accept="video/*,image/*"
                    style={{ display: "none" }}
                    disabled={customUploadLoading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      setCustomUploadLoading(true);
                      setCustomUploadError("");

                      try {
                        const ext = file.name.split('.').pop();
                        const fileName = `${new Date().toISOString().replace(/[:.]/g, '-')}_${Math.floor(Math.random()*10000)}.${ext}`;
                        const isVideo = file.type.startsWith("video/");
                        const format = isVideo ? "Video" : "Image";

                        const urlRes = await fetch("/api/upload-url", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ fileName, contentType: file.type }),
                        });
                        const urlData = await urlRes.json();
                        if (!urlRes.ok || urlData.error) throw new Error(urlData.error || "Failed to get upload URL");

                        const uploadRes = await fetch(urlData.signedUrl, {
                          method: "PUT",
                          headers: { "Content-Type": file.type, "x-upsert": "true" },
                          body: file,
                        });
                        if (!uploadRes.ok) throw new Error(`Storage upload failed (${uploadRes.status})`);

                        const recordRes = await fetch("/api/upload-ad-record", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ publicUrl: urlData.publicUrl, format }),
                        });
                        const record = await recordRes.json();
                        if (!recordRes.ok || record.error) throw new Error(record.error || "DB insert failed");

                        await fetchAdTableLinks();
                        addSbToast("Media uploaded! Approve it in Ad Previews below.", "success");
                      } catch (err: any) {
                        setCustomUploadError(err.message || "Upload failed");
                        console.error(err);
                      } finally {
                        setCustomUploadLoading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                {customUploadError && (
                  <div style={{ fontSize: 12, color: "var(--red-error)" }}>{customUploadError}</div>
                )}
              </div>
            </div>
          </section>

          <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.3</div>
        </EditorialPage>
      )}

      <div
        className="animate-fade-in"
        style={{ display: tab === "variants" ? "block" : "none" }}
      >
        <GenerateVariants
          embed={embed}
          onBusyChange={setVariantGenerationBusy}
          approvedAds={allApprovedAds}
          onContinueToCampaignSetup={(payload) => {
            setVariantAutomationId(payload.automationId);
            setVariantAds(payload.variants);
            setAutomationParams({
              numVariants: payload.numVariants,
              evalLengthDays: payload.evalLengthDays,
              dailyBudgetCents: payload.dailyBudgetCents,
            });
            setLaunchAdCandidate(null);
            setTab("campaigns");
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          CAMPAIGN SETUP
      ═══════════════════════════════════════════════════════ */}
      {tab === "campaigns" && (
        <CampaignSetup
          selectedId={selectedMetaCampaign?.id}
          selectedAd={launchAdCandidate}
          approvedAds={allApprovedAds}
          variantAutomationId={variantAutomationId}
          variantAds={variantAds}
          automationParams={automationParams}
          onSelect={(campaign) => setSelectedMetaCampaign(campaign)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          RUNNING CAMPAIGNS (LIVE META)
      ═══════════════════════════════════════════════════════ */}
      {tab === "live_campaigns" && (
        <EditorialPage>
          <EditorialPageHeader
            eyebrow="Meta Ads"
            title="Campaign Monitor"
            subtitle="Monitor and control your live Meta Ads."
            actions={<EditorialTextLink onClick={fetchLiveCampaigns}>{liveLoading ? "Refreshing…" : "Refresh"}</EditorialTextLink>}
          />

          {liveLoading && liveCampaigns.length === 0 && (
            <div style={{ padding: "48px 0", display: "flex", justifyContent: "center" }}>
              <Spinner size={32} color="var(--primary)" />
            </div>
          )}

          {liveError && (
            <p style={{ padding: "16px 0", color: "var(--red)", fontSize: 14, borderBottom: "1px solid var(--border)" }}>{liveError}</p>
          )}

          {!liveLoading && liveCampaigns.length === 0 && !liveError && (
            <EmptyState title="No campaigns found" sub="Start a new campaign in Campaign Setup." />
          )}

          {liveCampaigns.map((campaign, campaignIdx) => {
            const formatObjective = (objective) => {
              if (!objective) return "";
              const labels = {
                OUTCOME_AWARENESS: "Outcome awareness",
                OUTCOME_TRAFFIC: "Outcome traffic",
                OUTCOME_ENGAGEMENT: "Outcome engagement",
                OUTCOME_LEADS: "Outcome leads",
                OUTCOME_SALES: "Outcome sales",
                LINK_CLICKS: "Link clicks",
              };
              return labels[objective] || objective.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
            };
            const statusVariant = (status) => {
              if (status === "ACTIVE") return "active";
              if (status === "PAUSED") return "unapproved";
              return "neutral";
            };
            const formatStatus = (status) => {
              if (!status) return "";
              return status.charAt(0) + status.slice(1).toLowerCase();
            };

            return (
              <section key={campaign.id} style={{ marginTop: campaignIdx > 0 ? 56 : 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 24, paddingBottom: 14, borderBottom: "1px solid #003049", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21, color: "#003049", letterSpacing: "-0.3px" }}>{campaign.name}</div>
                    <div style={{ fontSize: 12.5, color: "#8C8474", marginTop: 3 }}>
                      ID · {campaign.id} &nbsp;·&nbsp; {formatObjective(campaign.objective)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <EditorialTextLink onClick={() => handleEditCampaign(campaign.id)} style={{ fontSize: 13.5, fontWeight: 700, color: "#4A5A64" }}>Edit</EditorialTextLink>
                    <EditorialTextLink
                      onClick={() => handleUpdateStatus(campaign.id, "Campaign", "PAUSED", "pause")}
                      disabled={campaign.effective_status === "PAUSED" || updatingStatusId === campaign.id}
                      style={{ fontSize: 13.5, fontWeight: 400, color: campaign.effective_status === "PAUSED" ? "#C2B79A" : "#8C8474" }}
                    >Pause</EditorialTextLink>
                    <EditorialTextLink
                      onClick={() => handleUpdateStatus(campaign.id, "Campaign", null, "delete")}
                      disabled={updatingStatusId === campaign.id}
                      style={{ fontSize: 13.5, fontWeight: 400, color: "#8C8474" }}
                    >Delete</EditorialTextLink>
                  </div>
                  <EditorialStatusPill variant={statusVariant(campaign.effective_status)}>
                    {formatStatus(campaign.effective_status)}
                  </EditorialStatusPill>
                </div>

                <div style={{ marginLeft: 28, borderLeft: "1px solid #E8DCC2", paddingLeft: 28 }}>
                  {campaign.adsets?.data?.length > 0 ? campaign.adsets.data.map(adset => (
                    <div key={adset.id}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 24, padding: "18px 0 12px", alignItems: "baseline" }}>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "#003049" }}>
                          {adset.name}{" "}
                          <span style={{ fontFamily: "inherit", fontWeight: 400, fontSize: 12.5, color: "#8C8474" }}>· ad set</span>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                          <EditorialTextLink onClick={() => handleEditAdSet(campaign.id, adset.id)} style={{ fontSize: 13, fontWeight: 700, color: "#4A5A64" }}>Edit</EditorialTextLink>
                          <EditorialTextLink
                            onClick={() => handleUpdateStatus(adset.id, "AdSet", "PAUSED", "pause")}
                            disabled={adset.effective_status === "PAUSED" || updatingStatusId === adset.id}
                            style={{ fontSize: 13, fontWeight: 400, color: adset.effective_status === "PAUSED" ? "#C2B79A" : "#8C8474" }}
                          >Pause</EditorialTextLink>
                          <EditorialTextLink
                            onClick={() => handleUpdateStatus(adset.id, "AdSet", null, "delete")}
                            disabled={updatingStatusId === adset.id}
                            style={{ fontSize: 13, fontWeight: 400, color: "#8C8474" }}
                          >Delete</EditorialTextLink>
                        </div>
                        <EditorialStatusPill variant={statusVariant(adset.effective_status)}>
                          {formatStatus(adset.effective_status)}
                        </EditorialStatusPill>
                      </div>

                      {adset.ads?.data?.length > 0 ? adset.ads.data.map(ad => {
                        const insights = ad.insights?.data?.[0] || {};
                        const ctr = parseFloat(insights.inline_link_click_ctr || 0);
                        const ctrAccent = ctr >= 1;
                        const isPaused = ad.effective_status === "PAUSED";
                        return (
                          <div
                            key={ad.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(180px, 1fr) repeat(3, 76px) auto auto",
                              gap: 16,
                              padding: "16px 0",
                              borderTop: "1px solid #E8DCC2",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#003049", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ad.name}</div>
                              <div style={{ fontSize: 12, color: "#8C8474", marginTop: 2 }}>ID · {ad.id}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474" }}>Spend</div>
                              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#003049", marginTop: 2 }}>${parseFloat(insights.spend || 0).toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474" }}>CTR</div>
                              <div style={{ fontSize: 14.5, fontWeight: 700, color: ctrAccent ? "#C1121F" : "#003049", marginTop: 2 }}>{ctr.toFixed(2)}%</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "#8C8474" }}>Clicks</div>
                              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#003049", marginTop: 2 }}>{insights.clicks || "0"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 14 }}>
                              {isPaused ? (
                                <EditorialTextLink
                                  onClick={() => handleUpdateStatus(ad.id, "Ad", "ACTIVE", "run")}
                                  disabled={updatingStatusId === ad.id}
                                  style={{ fontSize: 13, fontWeight: 700, color: "#003049", borderBottom: "1px solid #C2B79A", borderRadius: 0, paddingBottom: 1 }}
                                >Run</EditorialTextLink>
                              ) : (
                                <EditorialTextLink
                                  onClick={() => handleUpdateStatus(ad.id, "Ad", "PAUSED", "pause")}
                                  disabled={updatingStatusId === ad.id}
                                  style={{ fontSize: 13, fontWeight: 400, color: "#8C8474" }}
                                >Pause</EditorialTextLink>
                              )}
                              <EditorialTextLink
                                onClick={() => handleUpdateStatus(ad.id, "Ad", null, "delete")}
                                disabled={updatingStatusId === ad.id}
                                style={{ fontSize: 13, fontWeight: 400, color: "#8C8474" }}
                              >Delete</EditorialTextLink>
                            </div>
                            <EditorialStatusPill variant={statusVariant(ad.effective_status)}>
                              {formatStatus(ad.effective_status)}
                            </EditorialStatusPill>
                          </div>
                        );
                      }) : (
                        <div style={{ fontSize: 12, color: "#8C8474", padding: "16px 0", borderTop: "1px solid #E8DCC2" }}>No ads found in this set.</div>
                      )}
                    </div>
                  )) : (
                    <div style={{ fontSize: 13, color: "#8C8474", padding: "18px 0" }}>No ad sets found in this campaign.</div>
                  )}
                </div>
              </section>
            );
          })}

          <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.3</div>

          {editModalOpen && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
              <div style={{ background: "var(--surface)", width: 500, maxWidth: "90%", borderRadius: "var(--radius-lg)", padding: 24, display: "flex", flexDirection: "column", gap: 16, boxShadow: "var(--shadow-lg)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Edit {editType}</div>
                  <button onClick={() => setEditModalOpen(false)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>×</button>
                </div>

                {editLoading ? (
                  <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><Spinner size={24} color="var(--primary)" /></div>
                ) : editError ? (
                  <div style={{ padding: 12, background: "var(--red-light)", color: "var(--red-strong)", borderRadius: 8, fontSize: 13 }}>{editError}</div>
                ) : editData ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Name</div>
                      <input
                        type="text"
                        value={editData.name || ""}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", outline: "none", fontSize: 14 }}
                      />
                    </div>
                    {editType === "AdSet" && (
                      <>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Daily Budget (in cents)</div>
                          <input
                            type="number"
                            value={editData.daily_budget || ""}
                            onChange={(e) => setEditData({ ...editData, daily_budget: e.target.value })}
                            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", outline: "none", fontSize: 14 }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Target Locations (Country Codes, e.g. US, CA)</div>
                          <input
                            type="text"
                            value={(() => {
                              let t = editData.targeting;
                              if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                              return t?.geo_locations?.countries?.join(', ') || "";
                            })()}
                            onChange={(e) => updateTargeting('countries', e.target.value)}
                            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", outline: "none", fontSize: 14 }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Age Min</div>
                            <input
                              type="number" min="18" max="65"
                              value={(() => {
                                let t = editData.targeting;
                                if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                                return t?.age_min || 18;
                              })()}
                              onChange={(e) => updateTargeting('age_min', e.target.value)}
                              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", outline: "none", fontSize: 14 }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Age Max</div>
                            <input
                              type="number" min="18" max="65"
                              value={(() => {
                                let t = editData.targeting;
                                if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                                return t?.age_max || 65;
                              })()}
                              onChange={(e) => updateTargeting('age_max', e.target.value)}
                              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", outline: "none", fontSize: 14 }}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Gender</div>
                            <select
                              value={(() => {
                                let t = editData.targeting;
                                if (typeof t === 'string') try { t = JSON.parse(t); } catch (e) { t = {}; }
                                return t?.genders?.[0] || '0';
                              })()}
                              onChange={(e) => updateTargeting('gender', e.target.value)}
                              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", outline: "none", fontSize: 14 }}
                            >
                              <option value="0">All</option>
                              <option value="1">Male</option>
                              <option value="2">Female</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>End Date (Optional)</div>
                            <input
                              type="datetime-local"
                              value={editData.end_time ? new Date(editData.end_time).toISOString().slice(0, 16) : ""}
                              onChange={(e) => {
                                const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                                setEditData({ ...editData, end_time: newDate });
                              }}
                              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", outline: "none", fontSize: 14 }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                      <button
                        onClick={() => setEditModalOpen(false)}
                        style={{ flex: 1, padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, color: "var(--text)" }}
                      >Cancel</button>
                      <button
                        onClick={saveEdit}
                        disabled={editSaving}
                        style={{ flex: 1, padding: 12, borderRadius: 8, background: "var(--primary)", border: "none", cursor: editSaving ? "default" : "pointer", fontWeight: 600, color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, opacity: editSaving ? 0.7 : 1 }}
                      >
                        {editSaving ? <Spinner size={16} /> : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </EditorialPage>
      )}

      {/* ═══════════════════════════════════════════════════════
          AUTOMATED CAMPAIGNS
      ═══════════════════════════════════════════════════════ */}
      {tab === "ad_performance" && (
        <AdPerformance />
      )}

      {/* ═══════════════════════════════════════════════════════
          REPORTS — Meta Ads Performance Dashboard
      ═══════════════════════════════════════════════════════ */}
      {tab === "reports" && (
        <EditorialPage>
          <EditorialPageHeader
            eyebrow="Meta Ads Performance"
            title="Reports"
            subtitle="Real-time metrics and campaign performance from your Meta Ad account."
            actions={
              <EditorialTextLink onClick={fetchMetaInsights} style={{ opacity: metaReportsLoading ? 0.6 : 1 }}>
                {metaReportsLoading ? "Refreshing…" : "Refresh data"}
              </EditorialTextLink>
            }
          />

          {metaReportsError && (
            <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)", color: "var(--red)", fontSize: 14 }}>
              {metaReportsError}
            </div>
          )}

          {!metaInsights && !metaReportsLoading && !metaReportsError && (
            <div style={{ padding: "48px 0", textAlign: "center", borderTop: "1px solid var(--primary)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ready to load Meta Insights</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>Sync your live Facebook ad metrics into the dashboard.</div>
              <EditorialPillButton onClick={fetchMetaInsights}>Load performance data</EditorialPillButton>
            </div>
          )}

          {metaReportsLoading && !metaInsights && (
            <div style={{ padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, borderTop: "1px solid var(--primary)" }}>
              <Spinner size={32} color="var(--primary)" />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--primary)" }}>Connecting to Meta Graph API…</div>
            </div>
          )}

          {metaInsights && (
            <>
              <EditorialStatRibbon columns={4}>
                <EditorialStatCell
                  isFirst
                  value={`$${parseFloat(metaInsights.spend || 0).toFixed(2)}`}
                  label="Total spend"
                  sub="All time"
                />
                <EditorialStatCell
                  value={parseFloat(metaInsights.impressions || "0").toLocaleString()}
                  label="Impressions"
                  sub={`Reach · ${parseFloat(metaInsights.reach || "0").toLocaleString()}`}
                />
                <EditorialStatCell
                  value={parseFloat(metaInsights.linkClicks || "0").toLocaleString()}
                  label="Link clicks"
                  sub={`CTR · ${parseFloat(metaInsights.inline_link_click_ctr || 0).toFixed(2)}%`}
                  accent="danger"
                />
                <EditorialStatCell
                  isLast
                  value={parseFloat(metaInsights.leads || "0").toLocaleString()}
                  label="Conversions"
                  sub="Leads / responses"
                  accent="muted"
                />
              </EditorialStatRibbon>

              <section style={{ marginTop: 48 }}>
                <EditorialSectionHeader title="Campaign Breakdown" meta={`${metaCampaignInsights.length} campaigns`} />

                {metaCampaignInsights.length === 0 ? (
                  <p style={{ padding: "24px 0", margin: 0, fontSize: 14, color: "var(--text-muted)" }}>No campaigns found</p>
                ) : typeof window !== "undefined" && window.innerWidth <= 768 ? (
                  <div>
                    {metaCampaignInsights.map((c: any, idx: number, arr: any[]) => {
                      const ins = c.insights || {};
                      const isActive = c.effective_status === "ACTIVE";
                      return (
                        <div key={c.id} style={{ padding: "18px 0", borderTop: idx === 0 ? "1px solid var(--border)" : undefined, borderBottom: idx < arr.length - 1 ? "1px solid var(--border)" : "1px solid var(--border)" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>ID · {c.id}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#38678A", border: "1px solid #7FA6BC", borderRadius: 999, padding: "3px 10px" }}>{c.effective_status}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
                            <div><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Spend</div><div style={{ fontWeight: 700, color: "var(--primary)" }}>${parseFloat(ins.spend || 0).toFixed(2)}</div></div>
                            <div><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Impr.</div><div style={{ color: "#4A5A64" }}>{parseFloat(ins.impressions || "0").toLocaleString()}</div></div>
                            <div><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>CTR</div><div style={{ fontWeight: 700, color: parseFloat(ins.inline_link_click_ctr || 0) > 0 ? "var(--red)" : "#4A5A64" }}>{parseFloat(ins.inline_link_click_ctr || 0).toFixed(2)}%</div></div>
                            <div><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Leads</div><div style={{ color: "#4A5A64" }}>{parseFloat(ins.leads || "0").toLocaleString()}</div></div>
                          </div>
                          <EditorialTextLink onClick={() => setSelectedCampaignForReports(c)}>View details →</EditorialTextLink>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) auto repeat(4, 76px) auto", gap: 16, padding: "12px 0 8px", alignItems: "baseline", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      <div>Campaign</div><div>Status</div><div style={{ textAlign: "right" }}>Spend</div><div style={{ textAlign: "right" }}>Impr.</div><div style={{ textAlign: "right" }}>CTR</div><div style={{ textAlign: "right" }}>Leads</div><div />
                    </div>
                    {metaCampaignInsights.map((c: any, idx: number, arr: any[]) => {
                      const ins = c.insights || {};
                      const ctr = parseFloat(ins.inline_link_click_ctr || 0);
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(180px,1fr) auto repeat(4, 76px) auto",
                            gap: 16,
                            padding: "18px 0",
                            borderTop: "1px solid var(--border)",
                            borderBottom: idx === arr.length - 1 ? "1px solid var(--border)" : undefined,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>ID · {c.id}</div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#38678A", border: "1px solid #7FA6BC", borderRadius: 999, padding: "3px 10px" }}>
                            {c.effective_status}
                          </div>
                          <div style={{ textAlign: "right", fontSize: 14.5, fontWeight: 700, color: "var(--primary)" }}>${parseFloat(ins.spend || 0).toFixed(2)}</div>
                          <div style={{ textAlign: "right", fontSize: 14.5, color: "#4A5A64" }}>{parseFloat(ins.impressions || "0").toLocaleString()}</div>
                          <div style={{ textAlign: "right", fontSize: 14.5, fontWeight: ctr > 0 ? 700 : 400, color: ctr > 0 ? "var(--red)" : "#4A5A64" }}>{ctr.toFixed(2)}%</div>
                          <div style={{ textAlign: "right", fontSize: 14.5, color: "#4A5A64" }}>{parseFloat(ins.leads || "0").toLocaleString()}</div>
                          <EditorialTextLink onClick={() => setSelectedCampaignForReports(c)} style={{ fontSize: 13, color: "var(--primary)", borderBottom: "1px solid #C2B79A" }}>
                            View details
                          </EditorialTextLink>
                        </div>
                      );
                    })}
                  </>
                )}
              </section>
            </>
          )}
        </EditorialPage>
      )}

      {/* ── REPORTS AD DETAILS MODAL ── */}
      {selectedCampaignForReports && (() => {
        const c = selectedCampaignForReports;
        let allAds = [];
        if (c.adsets && c.adsets.length > 0) {
          c.adsets.forEach(adset => {
            if (adset.ads && adset.ads.length > 0) {
              allAds.push(...adset.ads);
            }
          });
        }

        return (
          <div
            onClick={() => setSelectedCampaignForReports(null)}
            className="animate-in fade-in duration-300"
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="animate-scale-in"
              style={{
                width: "100%", maxWidth: 900, maxHeight: "85vh",
                background: "var(--card-bg)", border: "0.5px solid var(--border)",
                borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
                display: "flex", flexDirection: "column", overflow: "hidden"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Campaign Creatives & Breakdown</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    {c.name} • {allAds.length} attached creative{allAds.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCampaignForReports(null)}
                  style={{
                    width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)",
                    background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                >✕</button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {allAds.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>No ad creatives found for this campaign.</div>
                  </div>
                ) : (
                  allAds.map(ad => {
                    const ins = ad.insights || {};
                    const thumbUrl = ad.creative?.thumbnail_url || null;
                    return (
                      <div key={ad.id} style={{
                        display: "flex", gap: 16, background: "var(--surface)", border: "1px solid var(--border-light)",
                        borderRadius: "var(--radius-md)", padding: 16, alignItems: "center"
                      }}>
                        <div style={{
                          width: 100, height: 100, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                          background: "var(--card-bg)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0
                        }}>
                          {thumbUrl ? (
                            <img src={thumbUrl} alt="Ad Thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ fontSize: 24 }}>🎬</div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{ad.name}</div>
                            <Badge
                              text={ad.effective_status}
                              color={ad.effective_status === "ACTIVE" ? "var(--green)" : "var(--amber)"}
                              bg={ad.effective_status === "ACTIVE" ? "var(--green-light)" : "var(--amber-light)"}
                            />
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Ad ID: {ad.id}</div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div style={{ background: "#fff", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>Spend</div>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>${parseFloat(ins.spend || 0).toFixed(2)}</div>
                            </div>
                            <div style={{ background: "#fff", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>Impressions</div>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>{parseFloat(ins.impressions || "0").toLocaleString()}</div>
                            </div>
                            <div style={{ background: "#fff", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>CTR</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)" }}>{parseFloat(ins.inline_link_click_ctr || 0).toFixed(2)}%</div>
                            </div>
                            <div style={{ background: "#fff", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>Leads</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{parseFloat(ins.leads || "0").toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          SOCIAL CHANNELS — Overview & Creator Studio
      ═══════════════════════════════════════════════════════ */}
      {tab === "social-overview" && (
        <SocialOverview onEditBrandContext={() => setTab("profile")} />
      )}
      {tab === "social-creator-studio" && (
        <SocialDash />
      )}

      {/* ═══════════════════════════════════════════════════════
          OUTREACH — Inline embed (no page navigation)
      ═══════════════════════════════════════════════════════ */}
      {OUTREACH_FUTURE_IDS.has(tab) && (
        <div className="animate-fade-in">
          <EmptyState title="Future Development" sub="" icon="🚧" />
        </div>
      )}
      {OUTREACH_IDS.has(tab) && !OUTREACH_FUTURE_IDS.has(tab) && (
        <OutreachTab activeTab={tab} />
      )}

      {/* ═══════════════════════════════════════════════════════
          BLOG MANAGEMENT — Inline embed
      ═══════════════════════════════════════════════════════ */}
      {BLOG_IDS.has(tab) && (
        <BlogTab activeTab={tab} />
      )}

      {/* ═══════════════════════════════════════════════════════
          NEWSLETTER — Inline embed
      ═══════════════════════════════════════════════════════ */}
      {NEWSLETTER_TAB_IDS.has(tab) && (
        <NewsletterTab activeTab={tab} />
      )}

      {/* ═══════════════════════════════════════════════════════
          PROFILE SECTION
      ═══════════════════════════════════════════════════════ */}
      {tab === "profile" && (
        <EditorialPage>
          <EditorialPageHeader
            eyebrow="Configuration"
            title="Brand & ICP Configuration"
            actions={
              !isEditingProfile ? (
                <>
                  <EditorialTextLink onClick={() => setBrandSnapshotsModalOpen(true)}>
                    Templates ({brandSnapshots.length})
                  </EditorialTextLink>
                  <EditorialPillButton variant="danger" onClick={handleStartEditingProfile} style={{ padding: "10px 24px", whiteSpace: "nowrap" }}>Edit</EditorialPillButton>
                </>
              ) : (
                <>
                  <EditorialTextLink onClick={handleCancelEditingProfile}>Cancel</EditorialTextLink>
                  <EditorialTextLink onClick={handleSaveAsNewTemplate} disabled={isSavingProfile}>Save as new</EditorialTextLink>
                  <EditorialPillButton variant="danger" onClick={handleSaveProfile} disabled={isSavingProfile} style={{ padding: "10px 24px", whiteSpace: "nowrap" }}>
                    {isSavingProfile ? <Spinner size={14} color="#fff" /> : "Save changes"}
                  </EditorialPillButton>
                </>
              )
            }
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: -24,
              marginBottom: 40,
              minHeight: 28,
            }}
          >
            {activeBrandContextLabel == null ? (
              <span style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading template…</span>
            ) : isEditingActiveTemplateLabel ? (
              <>
                <input
                  type="text"
                  value={activeTemplateLabelDraft}
                  onChange={(e) => setActiveTemplateLabelDraft(e.target.value)}
                  autoFocus
                  disabled={isSavingActiveTemplateLabel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSaveActiveTemplateLabel();
                    if (e.key === "Escape") handleCancelEditingActiveTemplateLabel();
                  }}
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "6px 10px",
                    minWidth: 200,
                    maxWidth: "100%",
                    background: "var(--card-bg)",
                  }}
                />
                <EditorialTextLink
                  onClick={() => void handleSaveActiveTemplateLabel()}
                  disabled={isSavingActiveTemplateLabel || !activeTemplateLabelDraft.trim()}
                >
                  {isSavingActiveTemplateLabel ? "Saving…" : "Save"}
                </EditorialTextLink>
                <EditorialTextLink
                  onClick={handleCancelEditingActiveTemplateLabel}
                  disabled={isSavingActiveTemplateLabel}
                >
                  Cancel
                </EditorialTextLink>
              </>
            ) : (
              <>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#4A5A64" }}>{activeBrandContextLabel}</span>
                {canRenameActiveTemplateLabel && (
                  <button
                    type="button"
                    onClick={handleStartEditingActiveTemplateLabel}
                    aria-label="Edit template name"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 4,
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--red)";
                      e.currentTarget.style.background = "rgba(193, 18, 31, 0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-muted)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Pencil size={15} strokeWidth={2} />
                  </button>
                )}
              </>
            )}
          </div>

          <section>
            <EditorialSectionHeader title="Brand Strategy" />
            <EditorialDefinitionList>
              {[
                { key: "valueProposition", label: "Value Proposition" },
                { key: "positioning", label: "Positioning" },
                { key: "productsAndServices", label: "Products & Services" },
                { key: "brandVoice", label: "Brand Voice" },
                { key: "competitors", label: "Competitors" },
                { key: "painPoints", label: "Pain Points" },
              ].map((field, index, arr) => (
                <EditorialDefinitionRow key={field.key} label={field.label} isLast={false}>
                  <EditorialField
                    value={displayProfileData[field.key as keyof typeof displayProfileData] as string}
                    onChange={(v) => setProfileData({ ...profileData, [field.key]: v })}
                    disabled={!isEditingProfile}
                    multiline
                    rows={field.key === "valueProposition" ? 3 : 2}
                  />
                </EditorialDefinitionRow>
              ))}
              <EditorialDefinitionRow label="Destination URL" isLast>
                <EditorialField
                  value={displayProfileData.destinationUrl}
                  onChange={(v) => setProfileData({ ...profileData, destinationUrl: v })}
                  disabled={!isEditingProfile}
                  placeholder="https://your-app.vercel.app/"
                />
              </EditorialDefinitionRow>
            </EditorialDefinitionList>
          </section>

          {visibleIcpFields.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <EditorialSectionHeader title="Ideal Customer Profiles" meta="One per module" />
              <EditorialDefinitionList>
                {visibleIcpFields.map((field, index) => (
                  <EditorialDefinitionRow
                    key={field.key}
                    label={field.label.replace(/^ICP - /, "")}
                    isLast={index === visibleIcpFields.length - 1}
                  >
                    <EditorialField
                      value={displayProfileData[field.key as keyof typeof displayProfileData] as string}
                      onChange={(v) => setProfileData({ ...profileData, [field.key]: v })}
                      disabled={!isEditingProfile}
                      multiline
                      rows={4}
                    />
                  </EditorialDefinitionRow>
                ))}
              </EditorialDefinitionList>
            </section>
          )}

          {isEditingProfile && (
            <footer style={{ marginTop: 64, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
                Save updates the active template <strong style={{ color: "var(--primary)" }}>{activeBrandContextLabel ?? "Current brand"}</strong>. Use “Save as new” to keep a separate copy.
              </span>
              <EditorialPillButton variant="outline" onClick={handleSaveProfile} disabled={isSavingProfile} style={{ marginLeft: "auto" }}>
                {isSavingProfile ? <Spinner size={14} color="var(--primary)" /> : "Save changes"}
              </EditorialPillButton>
            </footer>
          )}
        </EditorialPage>
      )}

      {/* Brand Saved Templates Modal */}
      {brandSnapshotsModalOpen && (
        <div
          onClick={() => setBrandSnapshotsModalOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 18, width: "100%", maxWidth: 760,
              maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #003049, #1A4A66)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <History size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Saved Brand Templates</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>Stored prompts for Competitors — select one as your analysis basis</div>
              </div>
              <button
                onClick={() => setBrandSnapshotsModalOpen(false)}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: "14px 20px", borderBottom: "1px solid #E8DCC2", background: "#FDF6E3" }}>
              <div style={{ fontSize: 12, color: "#8C8474" }}>
                Active Context:{" "}
                <span style={{ fontWeight: 700, color: "#23394A" }}>
                  {activeBrandContextLabel ?? "Loading brand and ICP…"}
                </span>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingBrandSnapshots ? (
                <div style={{ padding: 40, textAlign: "center", color: "#8C8474" }}>
                  <Spinner size={24} color="#003049" />
                  <div style={{ marginTop: 12, fontSize: 13 }}>Loading templates…</div>
                </div>
              ) : brandSnapshots.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#4A5A64" }}>No saved templates yet</div>
                  <div style={{ fontSize: 12, color: "#9FA8A3", marginTop: 6 }}>Edit your brand strategy and save — you&apos;ll be asked to name each new template.</div>
                </div>
              ) : (
                brandSnapshots.map((snapshot: any) => {
                  const isActive = activeBrandSnapshot?.id === snapshot.id;
                  const isExpanded = expandedBrandSnapshotId === snapshot.id;
                  const snapshotProfile = snapshotToProfile(snapshot);
                  const savedDate = snapshot.created_at
                    ? new Date(snapshot.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "";
                  return (
                    <div
                      key={snapshot.id}
                      style={{
                        border: `1.5px solid ${isActive ? "#003049" : "#E8DCC2"}`,
                        borderRadius: 14,
                        background: isActive ? "#E7F0F6" : "#fff",
                      }}
                    >
                      <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#23394A", lineHeight: 1.4 }}>
                            {snapshot.label || "Unnamed template"}
                          </div>
                          <div style={{ fontSize: 11, color: "#9FA8A3", marginTop: 4 }}>Saved {savedDate}</div>
                          {snapshot.positioning && (
                            <div style={{ fontSize: 12, color: "#8C8474", marginTop: 8, lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 600 }}>Positioning: </span>{snapshot.positioning}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => applyBrandSnapshotForAnalysis(snapshot)}
                            style={{
                              padding: "8px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                              ...(isActive
                                ? { border: "none", background: "#1A4A66", color: "#fff" }
                                : { border: "1px solid var(--primary-mid)", background: "var(--primary-mid)", color: "var(--primary-dark)" }),
                            }}
                          >
                            {isActive ? "✓ Active" : "Make Active"}
                          </button>
                          <button
                            onClick={() => setExpandedBrandSnapshotId(isExpanded ? null : snapshot.id)}
                            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E8DCC2", background: "#fff", color: "#8C8474", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            {isExpanded ? "Hide details" : "View"}
                          </button>
                          <button
                            onClick={() => handleDeleteBrandSnapshot(snapshot)}
                            disabled={isActive || deletingSnapshotId === snapshot.id}
                            title={isActive ? "Switch to another template before deleting the active one" : undefined}
                            style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${isActive ? "#E8DCC2" : "#FECACA"}`, background: isActive ? "#FDF6E3" : "#F9E3E0", color: isActive ? "#9FA8A3" : "#C1121F", fontSize: 11, fontWeight: 600, cursor: isActive || deletingSnapshotId === snapshot.id ? "not-allowed" : "pointer", opacity: deletingSnapshotId === snapshot.id ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                          >
                            {deletingSnapshotId === snapshot.id ? (
                              <Spinner size={12} color="#C1121F" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #E8DCC2", background: "#FAFBFC", borderRadius: "0 0 14px 14px" }}>
                          {[
                            ...BRAND_STRATEGY_FIELDS,
                            BRAND_DESTINATION_FIELD,
                            ...(moduleAccessLoaded
                              ? filterBrandIcpFieldsByEnabledModules(BRAND_ICP_FIELDS, enabledModuleIds)
                              : []),
                          ].map(({ key, label }) => {
                            const value =
                              key === "destinationUrl" ? profileData.destinationUrl : snapshotProfile[key];
                            return (
                              <div key={key}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                                <div style={{ fontSize: 12, color: value ? "#23394A" : "#9FA8A3", lineHeight: 1.6, whiteSpace: "pre-wrap", fontStyle: value ? "normal" : "italic" }}>
                                  {value || "Not set"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Name new brand template modal */}
      {templateNameModalOpen && (
        <div
          onClick={handleCancelTemplateName}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 18, width: "100%", maxWidth: 440,
              overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ padding: "18px 22px", background: "linear-gradient(135deg, #003049, #1A4A66)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Save as new template</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                Give this version a name — it will be stored as a separate template for Competitors.
              </div>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8C8474", marginBottom: 8 }}>
                Template name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Q2 Landlord Focus, Canada Launch…"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmTemplateName();
                  if (e.key === "Escape") handleCancelTemplateName();
                }}
                style={{
                  width: "100%", padding: "11px 14px", fontSize: 14,
                  border: "1.5px solid #669BBC", borderRadius: 12,
                  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                <button
                  onClick={handleCancelTemplateName}
                  disabled={isSavingTemplateName}
                  style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #E8DCC2", background: "#fff", color: "#8C8474", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Skip
                </button>
                <button
                  onClick={handleConfirmTemplateName}
                  disabled={isSavingTemplateName || !templateNameInput.trim()}
                  style={{
                    padding: "9px 20px", borderRadius: 10, border: "none",
                    background: "#003049", color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: isSavingTemplateName || !templateNameInput.trim() ? "not-allowed" : "pointer",
                    opacity: isSavingTemplateName || !templateNameInput.trim() ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 7,
                  }}
                >
                  {isSavingTemplateName ? <Spinner size={14} color="#fff" /> : "Save template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          AD DETAILS MODAL (POP-UP)
      ═══════════════════════════════════════════════════════ */}
      {selectedAdForDetails && (() => {
        // Reactive lookup: ensure modal status stays in sync with state updates
        const adId = selectedAdForDetails.id;
        const adTime = selectedAdForDetails.time;

        const currentAdInPreview = allPreviewAds.find((x) => x.id === adId && x.time === adTime);
        const currentAdInCreate = adTableLinks[adId];
        const currentAdInApproved = allApprovedAds.find(x => x.id === adId && x.time === adTime);

        // Prioritize live status from state
        const ad = currentAdInPreview
          || (currentAdInCreate?.time === adTime ? currentAdInCreate : null)
          || currentAdInApproved
          || selectedAdForDetails;

        let jsonData: any = {};
        try {
          const raw = ad["json data"];
          jsonData = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
        } catch (e) { console.error("JSON parse error:", e); }

        const isVid = (ad.format || "").toLowerCase() === "video";
        const isMobileModal = typeof window !== "undefined" && window.innerWidth <= 768;
        const destinationUrl = getAdDestinationUrl(jsonData) || profileData.destinationUrl || "";
        const sourcePrompt = getAdSourcePrompt(ad, jsonData);
        const firstAd = getAdJsonRecord(jsonData);

        return (
          <div
            className="animate-in fade-in duration-300"
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.85)", zIndex: 2000,
              display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
              backdropFilter: "blur(6px)"
            }}
            onClick={() => { setSelectedAdForDetails(null); setIsEditingAd(false); setIsRetryingAd(false); setRetryPrompt(""); }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff", width: "100%", maxWidth: isMobileModal ? "100%" : 860,
                borderRadius: isMobileModal ? 16 : 20, overflow: "hidden", display: "flex",
                flexDirection: "column", maxHeight: "94vh",
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                border: "1px solid #E8DCC2",
              }}
            >
              {/* ── Modal Header ── */}
              <div style={{ padding: isMobileModal ? "12px 16px" : "16px 24px", borderBottom: "1px solid #FDF0D5", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FDF6E3", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", background: isVid ? "#E7F0F6" : "#fffbeb", color: isVid ? "#1A4A66" : "#b45309", border: `1px solid ${isVid ? "#C2D6E2" : "#fde68a"}` }}>
                    {isVid ? "🎬 Video" : "🖼️ Image"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#003049" }}>Ad ID: <span style={{ fontFamily: "monospace", color: "#4A5A64" }}>{ad.id}</span></div>
                  {!isMobileModal && <div style={{ fontSize: 11, color: "#9FA8A3" }}>· {new Date(ad.time).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isEditingAd && !isRetryingAd && (
                    <button
                      onClick={() => {
                        setIsEditingAd(true);
                        const firstAd = getAdJsonRecord(jsonData);
                        setEditingAdData({
                          campaignName: jsonData.campaign?.name || "Untitled Campaign",
                          adName: firstAd.name || firstAd.ad_name || "Untitled Ad",
                          headline: firstAd.headline || "No headline provided.",
                          primaryText: getAdDescription(jsonData),
                          ctaType: firstAd.call_to_action_type || "WATCH_MORE",
                          linkData: getAdDestinationUrl(jsonData) || profileData.destinationUrl || DEFAULT_WEBSITE_URL || "",
                        });
                      }}
                      style={{ padding: "7px 16px", borderRadius: 9, border: "1.5px solid #E8DCC2", background: "#fff", color: "#003049", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      ✎ Edit
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedAdForDetails(null); setIsEditingAd(false); setIsRetryingAd(false); setRetryPrompt(""); }}
                    style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #E8DCC2", background: "#fff", fontSize: 18, cursor: "pointer", color: "#8C8474", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* ── Modal Body ── */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, flexDirection: isMobileModal ? "column" : "row" }}>
                {/* Media Panel */}
                <div style={{
                  width: isMobileModal ? "100%" : "42%",
                  height: isMobileModal ? 240 : "auto",
                  flexShrink: 0, background: "#003049",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRight: isMobileModal ? "none" : "1px solid #23394A",
                  borderBottom: isMobileModal ? "1px solid #23394A" : "none",
                }}>
                  {isVid ? (
                    <video src={ad.text} controls style={{ width: "100%", height: "100%", objectFit: "contain", maxHeight: isMobileModal ? 240 : "80vh" }} />
                  ) : (
                    <img src={ad.text} alt="Ad" style={{ width: "100%", height: "100%", objectFit: "contain", maxHeight: isMobileModal ? 240 : "80vh" }} />
                  )}
                </div>

                {/* Info Panel */}
                <div style={{ flex: 1, padding: isMobileModal ? "16px" : "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: isMobileModal ? 14 : 20 }}>

                  {/* Campaign & Ad Name */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobileModal ? "1fr" : "1fr 1fr", gap: isMobileModal ? 10 : 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Campaign Name</div>
                      {isEditingAd ? (
                        <input value={editingAdData.campaignName} onChange={(e) => setEditingAdData({ ...editingAdData, campaignName: e.target.value })}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #003049", background: "#fff", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#003049" }}>{jsonData.campaign?.name || "Untitled Campaign"}</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Ad Name</div>
                      {isEditingAd ? (
                        <input value={editingAdData.adName} onChange={(e) => setEditingAdData({ ...editingAdData, adName: e.target.value })}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #003049", background: "#fff", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#003049" }}>{firstAd.name || firstAd.ad_name || "Untitled Ad"}</div>
                      )}
                    </div>
                  </div>

                  {/* Headline */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Ad Headline</div>
                    {isEditingAd ? (
                      <textarea value={editingAdData.headline} onChange={(e) => setEditingAdData({ ...editingAdData, headline: e.target.value })}
                        style={{ width: "100%", minHeight: 72, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #003049", background: "#fff", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                    ) : (
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#003049", lineHeight: 1.6, padding: "12px 14px", background: "#FDF6E3", borderRadius: 10, border: "1px solid #E8DCC2" }}>
                          {firstAd.headline || "No headline provided."}
                        </div>
                    )}
                  </div>

                  {/* Description */}
                  {(isEditingAd || getAdDescription(jsonData)) && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Description</div>
                      {isEditingAd ? (
                        <textarea
                          value={editingAdData.primaryText || ""}
                          onChange={(e) => setEditingAdData({ ...editingAdData, primaryText: e.target.value })}
                          rows={4}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #003049", background: "#fff", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      ) : (
                        <div style={{ fontSize: 13, color: "#4A5A64", lineHeight: 1.7, padding: "12px 14px", background: "#FDF6E3", borderRadius: 10, border: "1px solid #E8DCC2" }}>
                          {getAdDescription(jsonData) || "No description provided."}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA + Link */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobileModal ? "1fr" : "1fr 1fr", gap: isMobileModal ? 10 : 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Call to Action</div>
                      {isEditingAd ? (
                        <select value={editingAdData.ctaType} onChange={(e) => {
                          const newCta = e.target.value;
                          const suggestions: Record<string, string> = { WHATSAPP_MESSAGE: "+10000000000", CONTACT_US: `${DEFAULT_WEBSITE_URL}/contact`, MESSAGE_PAGE: `${DEFAULT_WEBSITE_URL}/contact` };
                          setEditingAdData({ ...editingAdData, ctaType: newCta, linkData: suggestions[newCta] || editingAdData.linkData || profileData.destinationUrl || DEFAULT_WEBSITE_URL });
                        }} style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #003049", backgroundColor: "#fff", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box", cursor: "pointer", ...SELECT_ARROW_STYLE }}>
                          <option value="WATCH_MORE">Watch More</option>
                          <option value="LEARN_MORE">Learn More</option>
                          <option value="BOOK_NOW">Book Now</option>
                          <option value="SHOP_NOW">Shop Now</option>
                          <option value="SIGN_UP">Sign Up</option>
                          <option value="CONTACT_US">Contact Us</option>
                          <option value="APPLY_NOW">Apply Now</option>
                          <option value="GET_OFFER">Get Offer</option>
                          <option value="WHATSAPP_MESSAGE">WhatsApp</option>
                          <option value="MESSAGE_PAGE">Message Page</option>
                        </select>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 14px", background: "#E7F0F6", color: "#1A4A66", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid #C2D6E2" }}>
                          {(firstAd.call_to_action_type || "WATCH_MORE").replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Destination URL</div>
                      {isEditingAd ? (
                        <input
                          value={editingAdData.linkData}
                          onChange={(e) => setEditingAdData({ ...editingAdData, linkData: e.target.value })}
                          placeholder="https://your-website.com"
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #003049", background: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                      ) : destinationUrl ? (
                        <a
                          href={destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 13, color: "#003049", fontWeight: 600, textDecoration: "none",
                            display: "block", lineHeight: 1.5, wordBreak: "break-all",
                            padding: "12px 14px", background: "#FDF6E3", borderRadius: 10, border: "1px solid #E8DCC2",
                          }}
                        >
                          {destinationUrl}
                        </a>
                      ) : (
                        <div style={{ fontSize: 13, color: "#9FA8A3", lineHeight: 1.5, padding: "12px 14px", background: "#FDF6E3", borderRadius: 10, border: "1px dashed #E8DCC2" }}>
                          Not set — click Edit to add your landing page URL
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Source Prompt */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                      Source Prompt
                    </div>
                    <div style={{
                      fontSize: 13, color: sourcePrompt ? "#4A5A64" : "#9FA8A3", lineHeight: 1.7,
                      padding: "12px 14px", background: "#FDF6E3", borderRadius: 10, border: "1px solid #E8DCC2",
                      whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflowY: "auto",
                    }}>
                      {sourcePrompt || "No source prompt saved for this ad."}
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid var(--border-light)", display: "flex", gap: 12 }}>
                    {isEditingAd ? (
                      <>
                        <button
                          onClick={() => setIsEditingAd(false)}
                          style={{
                            flex: 1, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: "pointer"
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdits(ad)}
                          disabled={isSavingAd}
                          style={{
                            flex: 1, padding: "12px", background: "var(--primary)", border: "none",
                            borderRadius: "var(--radius-md)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer"
                          }}
                        >
                          {isSavingAd ? <Spinner size={12} /> : "Save Changes"}
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          href={ad.text}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1, textDecoration: "none", textAlign: "center", padding: "12px",
                            background: "var(--surface)", border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)", color: "var(--text)", fontWeight: 600, fontSize: 13
                          }}
                        >
                          Download Media
                        </a>
                        <button
                          style={{
                            flex: 1, padding: "12px",
                            background: isAdApproved(ad.Approved) ? "linear-gradient(135deg, var(--primary), #6366f1)" : "var(--primary)",
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            color: "#fff",
                            fontWeight: 700, fontSize: 13,
                            cursor: isAdApproved(ad.Approved) || approvingId === (ad.id + "_" + ad.time) ? (isAdApproved(ad.Approved) ? "pointer" : "not-allowed") : "pointer",
                            opacity: approvingId === (ad.id + "_" + ad.time) ? 0.7 : 1,
                            transition: "all 0.2s"
                          }}
                          disabled={approvingId === (ad.id + "_" + ad.time) || (!isAdApproved(ad.Approved) && !ad.text)}
                          onClick={async () => {
                            if (isAdApproved(ad.Approved)) {
                              setLaunchAdCandidate(ad);
                              setSelectedAdForDetails(null);
                              setTab("campaigns");
                              return;
                            }
                            await handleApproveAd(ad);
                          }}
                        >
                          {approvingId === (ad.id + "_" + ad.time) ? (
                            <Spinner size={12} />
                          ) : isAdApproved(ad.Approved) ? (
                            "Send to Campaign Setup"
                          ) : (
                            "Approve"
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast Notifications */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
        {sbToasts.map((t) => (
          <div key={t.id} className="animate-toast" style={{
            minWidth: 280, padding: "14px 20px", borderRadius: "var(--radius-md)", background: "#fff",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
            border: `1px solid ${t.type === "error" ? "var(--red-error)" : "var(--primary)"}`,
            display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${t.type === "error" ? "var(--red-error)" : "var(--primary)"}`
          }}>
            <span style={{ fontSize: 18 }}>{t.type === "error" ? "⚠️" : "✨"}</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {t.type === "error" ? "Error" : "Success"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-body)" }}>{t.message}</div>
            </div>
            <button
              onClick={() => setSbToasts(prev => prev.filter(toast => toast.id !== t.id))}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16 }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* ── Scenes Prompt Modal ── */}
      {scenesModal.open && (() => {
        // Determine which scenes are failed — match by itemId + sceneIndex (reliable, no text comparison)
        const modalFailures = (failedPrompts as any[]).filter(
          (fail) => String(fail.itemId) === String(scenesModal.itemId)
        );
        const hasFailuresInModal = modalFailures.length > 0;
        const headerBg = hasFailuresInModal
          ? "linear-gradient(135deg, #C1121F, #C1121F)"
          : "linear-gradient(135deg, #003049, #0ea5e9)";

        return (
        <div
          onClick={() => {
            if (hasUnsavedChanges) {
              addSbToast("You have unsaved changes. Click \"Save Changes\" before closing.", "error");
              return;
            }
            setHasUnsavedChanges(false);
            setScenesModal({ open: false, scenes: [], adLabel: "", itemId: null });
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 18, width: "100%", maxWidth: 980,
              maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: hasFailuresInModal ? "0 32px 80px rgba(220,38,38,0.35)" : "0 32px 80px rgba(0,0,0,0.35)",
              border: hasFailuresInModal ? "2px solid #C1121F" : "none",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "14px 16px", background: headerBg, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Row 1: title + scene count */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18 }}>{hasFailuresInModal ? "⚠️" : "🎬"}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", flex: 1, minWidth: 0 }}>
                  {scenesModal.adLabel} — Prompts
                </span>
                <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", padding: "3px 10px", borderRadius: 20, color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {editedScenes.length} scenes
                </span>
                {!hasFailuresInModal && (
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", padding: "2px 8px", borderRadius: 20, color: "#e0f2fe", whiteSpace: "nowrap" }}>✏️ Editable</span>
                )}
                {hasFailuresInModal && (
                  <span style={{ fontSize: 10, background: "rgba(255,255,255,0.25)", padding: "2px 8px", borderRadius: 20, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{modalFailures.length} FAILED</span>
                )}
              </div>
              {/* Row 2: action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Save — writes edits back to adScenesMap */}
                <button
                  onClick={() => {
                    if (scenesModal.itemId) {
                      setAdScenesMap(prev => {
                        const updated = { ...prev };
                        Object.keys(updated).forEach(k => {
                          if (updated[k] === prev[scenesModal.itemId] || k === String(scenesModal.itemId)) {
                            updated[k] = editedScenes;
                          }
                        });
                        return updated;
                      });
                      // Also sync edits back into failedPrompts so retry uses new text
                      if (hasFailuresInModal) {
                        setFailedPrompts((prev: any[]) => prev.map(f => {
                          if (String(f.itemId) !== String(scenesModal.itemId)) return f;
                          const updated = editedScenes[f.sceneIndex];
                          return updated ? { ...f, prompt: updated.prompt || updated.prompt_clean || f.prompt } : f;
                        }));
                      }
                    }
                    setHasUnsavedChanges(false);
                  }}
                  style={{ background: "#fff", border: "none", color: hasFailuresInModal ? "#C1121F" : "#003049", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 800, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                >{hasUnsavedChanges ? "💾 Save Changes *" : "✓ Saved"}</button>

                {/* When failures: show hint to use Start Again button */}
                {hasFailuresInModal && (
                  <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#fff", fontWeight: 600 }}>
                    Save edits, close, then click <b>Start Again</b> ↓
                  </div>
                )}

                <button
                  onClick={() => {
                    setHasUnsavedChanges(false);
                    setScenesModal({ open: false, scenes: [], adLabel: "", itemId: null });
                  }}
                  style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >✕ Close</button>
              </div>
            </div>

            {/* ── Failure Warning Banner ── */}
            {hasFailuresInModal && (
              <div style={{
                background: "#F9E3E0", borderBottom: "2px solid #fecaca",
                padding: "12px 24px", display: "flex", flexDirection: "column", gap: 8
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#C1121F" }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  {modalFailures.length} scene(s) failed — highlighted in red below. Edit the prompt, save, close, then click <b>Start Again</b>.
                </div>
                {modalFailures.map((fail, fi) => (
                  <div key={fi} style={{
                    background: "#fff", border: "1px solid #fecaca", borderRadius: 8,
                    padding: "8px 14px", fontSize: 11, color: "#780000", lineHeight: 1.6
                  }}>
                    <span style={{ fontWeight: 700 }}>Error:</span> {fail.failMsg}
                  </div>
                ))}
              </div>
            )}

            {/* Column headers — hidden on mobile (cards show their own labels) */}
            <div className="scenes-modal-headers" style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr", padding: "10px 20px", background: "#FDF6E3", borderBottom: "1.5px solid #E8DCC2" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#9FA8A3", textTransform: "uppercase" }}>#</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#003049", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 16 }}>🖼️ Image Prompt</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#669BBC", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 16 }}>🎬 Video Scenario</div>
            </div>

            {/* Editable scenes rows */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {editedScenes.map((scene: any, i: number) => {
                // Check if this specific scene is a failed one
                // Match by itemId + sceneIndex — i is the scene position in editedScenes
                const failEntry = (failedPrompts as any[]).find(
                  (fail) => String(fail.itemId) === String(scenesModal.itemId) && fail.sceneIndex === i
                );
                const sceneIsFailed = !!failEntry;
                const sceneFailMsg = failEntry?.failMsg || "";

                return (
                  <div key={i} style={{ borderBottom: "1px solid #FDF0D5" }}>
                    {/* Failed scene warning sub-header */}
                    {sceneIsFailed && (
                      <div style={{
                        padding: "6px 20px", background: "#F9E3E0", borderBottom: "1px solid #fecaca",
                        fontSize: 11, fontWeight: 700, color: "#C1121F",
                        display: "flex", alignItems: "center", gap: 6
                      }}>
                        <span>⚠️ Scene {scene.scene} failed:</span>
                        <span style={{ fontWeight: 500 }}>{sceneFailMsg}</span>
                      </div>
                    )}
                    {/* ── Desktop: side-by-side grid | Mobile: stacked cards ── */}
                    {typeof window !== "undefined" && window.innerWidth > 768 ? (
                      /* DESKTOP — original 3-col grid */
                      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr", background: sceneIsFailed ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#FDF6E3" }}>
                        {/* # */}
                        <div style={{ padding: "16px 8px", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 18 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: sceneIsFailed ? "#C1121F" : "#003049", color: "#fff", fontSize: 11, fontWeight: 800 }}>{scene.scene}</span>
                        </div>
                        {/* Image Prompt */}
                        <div style={{ padding: "12px 12px 12px 0", borderRight: "1px solid #E8DCC2" }}>
                          {scene.script_line && <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em", color: sceneIsFailed ? "#C1121F" : "#003049" }}>{scene.script_line}</div>}
                          <textarea value={scene.prompt_clean || scene.prompt || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],prompt_clean:e.target.value,prompt:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={5}
                            style={{ width:"100%", fontSize:11, color:"#23394A", lineHeight:1.75, border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #E8DCC2", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#FDF6E3", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#C1121F":"#003049"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#E8DCC2"} />
                        </div>
                        {/* Video Scenario */}
                        <div style={{ padding: "12px 12px" }}>
                          <textarea value={scene.video_scenario || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],video_scenario:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={5}
                            style={{ width:"100%", fontSize:11, lineHeight:1.75, color: sceneIsFailed?"#780000":"#2C5A77", border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #E8DCC2", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#E7F0F6", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#C1121F":"#669BBC"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#E8DCC2"} />
                          {scene.emotion_type && (
                            <span style={{ marginTop:6, display:"inline-block", fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700, border:"1px solid", background: scene.emotion_type==="happy"?"#f0fdf4":scene.emotion_type==="sad"?"#E7F0F6":"#fafafa", color: scene.emotion_type==="happy"?"#15803d":scene.emotion_type==="sad"?"#1A4A66":"#8C8474", borderColor: scene.emotion_type==="happy"?"#bbf7d0":scene.emotion_type==="sad"?"#C2D6E2":"#E8DCC2" }}>{scene.emotion_type}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* MOBILE — stacked card */
                      <div className="scene-row" style={{ padding:"14px 16px", background: sceneIsFailed?"#fff5f5":i%2===0?"#fff":"#FDF6E3", display:"flex", flexDirection:"column", gap:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:"50%", background: sceneIsFailed?"#C1121F":"#003049", color:"#fff", fontSize:11, fontWeight:800, flexShrink:0 }}>{scene.scene}</span>
                          {scene.script_line && <div style={{ fontSize:11, fontWeight:700, color: sceneIsFailed?"#C1121F":"#003049", textTransform:"uppercase", letterSpacing:"0.04em" }}>{scene.script_line}</div>}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#003049", textTransform:"uppercase", letterSpacing:"0.05em" }}>🖼️ Image Prompt</div>
                          <textarea value={scene.prompt_clean || scene.prompt || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],prompt_clean:e.target.value,prompt:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={4}
                            style={{ width:"100%", fontSize:12, color:"#23394A", lineHeight:1.6, border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #C2D6E2", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#E7F0F6", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#C1121F":"#003049"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#C2D6E2"} />
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#669BBC", textTransform:"uppercase", letterSpacing:"0.05em" }}>🎬 Video Scenario</div>
                          <textarea value={scene.video_scenario || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],video_scenario:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={4}
                            style={{ width:"100%", fontSize:12, lineHeight:1.6, color: sceneIsFailed?"#780000":"#2C5A77", border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #ddd6fe", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#E7F0F6", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#C1121F":"#669BBC"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#ddd6fe"} />
                          {scene.emotion_type && (
                            <span style={{ marginTop:6, display:"inline-block", fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700, border:"1px solid", background: scene.emotion_type==="happy"?"#f0fdf4":scene.emotion_type==="sad"?"#E7F0F6":"#fafafa", color: scene.emotion_type==="happy"?"#15803d":scene.emotion_type==="sad"?"#1A4A66":"#8C8474", borderColor: scene.emotion_type==="happy"?"#bbf7d0":scene.emotion_type==="sad"?"#C2D6E2":"#E8DCC2" }}>{scene.emotion_type}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Edit Image Prompt Modal ── */}
      {editingImagePrompt?.open && (
        <div
          onClick={() => setEditingImagePrompt(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 18, width: "100%", maxWidth: 680,
              boxShadow: "0 32px 80px rgba(220,38,38,0.35)",
              border: "2px solid #C1121F", overflow: "hidden", display: "flex", flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div style={{ background: "linear-gradient(135deg, #C1121F, #C1121F)", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>✏️</span>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Edit Image Prompt — Image #{(editingImagePrompt.index ?? 0) + 1}</div>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>Modify the prompt to comply with content policy, then resubmit</div>
                </div>
              </div>
              <button
                onClick={() => setEditingImagePrompt(null)}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 12px", fontSize: 18, fontWeight: 700, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Reason */}
              <div style={{ background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🚫</span>
                <div style={{ fontSize: 13, color: "#780000", lineHeight: 1.5 }}><b>Violation reason: </b>{editingImagePrompt.reason}</div>
              </div>

              {/* Editable prompt */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Image Prompt
                </label>
                <textarea
                  value={editingImagePrompt.prompt}
                  onChange={e => setEditingImagePrompt(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                  rows={8}
                  style={{
                    width: "100%", fontSize: 13, color: "#23394A", lineHeight: 1.7,
                    border: "1.5px solid #f87171", borderRadius: 10, padding: "12px 14px",
                    resize: "vertical", fontFamily: "inherit", outline: "none",
                    background: "#fff1f2", boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = "#C1121F"}
                  onBlur={e => e.target.style.borderColor = "#f87171"}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setEditingImagePrompt(null)}
                  style={{ background: "#FDF0D5", border: "1px solid #E8DCC2", borderRadius: 10, color: "#4A5A64", cursor: "pointer", padding: "10px 20px", fontSize: 13, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!editingImagePrompt) return;
                    const updatedPrompt = editingImagePrompt.prompt.trim();
                    if (!updatedPrompt) return;
                    // Update the failedImagePrompts list with the new prompt
                    setFailedImagePrompts(prev => prev.map(fp =>
                      fp.index === editingImagePrompt.index ? { ...fp, prompt: updatedPrompt } : fp
                    ));
                    // Resubmit via native image generation
                    try {
                      const concept = {
                        id: editingImagePrompt.index,
                        title: "Resubmit",
                        prompt: `*${updatedPrompt}*`,
                        headline: "Resubmit Ad",
                        cta: "Get Started",
                      };
                      const generateRes = await fetch(CREATE_AD_IMAGE_GENERATE_API, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ concepts: [concept] }),
                      });
                      const generateData = await generateRes.json();
                      if (!generateRes.ok) throw new Error(generateData.error || "Generate failed");
                      const pollResults = await pollKieTasks((generateData.tasks || []).map((t: any) => t.taskId));
                      const finalizeRes = await fetch(CREATE_AD_IMAGE_FINALIZE_API, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          concepts: [concept],
                          pollResults,
                          report_data: analysisData,
                          ads_config: createTabAdsConfig,
                        }),
                      });
                      if (finalizeRes.ok) {
                        // Remove this prompt from failed list on success
                        setFailedImagePrompts(prev => prev.filter(fp => fp.index !== editingImagePrompt.index));
                        addSbToast("Prompt resubmitted successfully!", "success");
                      } else {
                        addSbToast("Resubmit failed — please try again.", "error");
                      }
                    } catch {
                      addSbToast("Error resubmitting prompt.", "error");
                    }
                    setEditingImagePrompt(null);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #003049, #669BBC)", border: "none", borderRadius: 10,
                    color: "#fff", cursor: "pointer", padding: "10px 24px", fontSize: 13, fontWeight: 700,
                    boxShadow: "0 4px 12px rgba(0,48,73,0.3)",
                  }}
                >
                  Resubmit Prompt →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Voice Explorer Modal (Create Ads) ── */}
      {voiceModalOpenForId !== null && (() => {
        const currentItem = createTabAdsConfig.items.find((it: any) => it.id === voiceModalOpenForId);
        return (
          <VoiceExplorerModal
            isOpen={voiceModalOpenForId !== null}
            onOpenChange={(open) => { if (!open) setVoiceModalOpenForId(null); }}
            selectedVoiceId={currentItem?.voiceId || ""}
            onSelectVoice={(id, label) => {
              if (voiceModalOpenForId !== null) {
                setCreateTabAdsConfig((prev: any) => {
                  const newItems = [...prev.items];
                  const idx = newItems.findIndex((it: any) => it.id === voiceModalOpenForId);
                  if (idx !== -1) newItems[idx] = { ...newItems[idx], voiceId: id };
                  return { ...prev, items: newItems };
                });
                setVoiceLabels(prev => ({ ...prev, [voiceModalOpenForId]: label }));
              }
              setVoiceModalOpenForId(null);
            }}
          />
        );
      })()}

      </main>

      {errorNotification && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '100%',
            maxWidth: '380px',
            animation: 'sdSlideIn 0.25s ease-out forwards',
            pointerEvents: 'auto'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1.5px solid #fca5a5',
              borderLeft: '6px solid #C1121F',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)',
              padding: '16px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div 
                style={{
                  background: '#fee2e2',
                  borderRadius: '50%',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#C1121F',
                  flexShrink: 0
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ flex: 1, paddingRight: '20px' }}>
                <h3 
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#780000',
                    margin: '0 0 4px 0',
                    lineHeight: '1.2'
                  }}
                >
                  Workflow Execution Error
                </h3>
                <p 
                  style={{
                    fontSize: '12px',
                    color: '#4A5A64',
                    margin: 0,
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontWeight: 500
                  }}
                >
                  {errorNotification}
                </p>
              </div>

              {/* Small close button in top right of the toast */}
              <button
                onClick={async () => {
                  if (errorNotification) {
                    localStorage.setItem("app_last_dismissed_error_msg", errorNotification.trim());
                  }
                  try {
                    await supabase
                      .from("Error Alerts")
                      .update({ Error: "" })
                      .eq("id", 1);
                  } catch (e) {
                    console.warn("Could not clear error from Supabase:", e);
                  }
                  setErrorNotification(null);
                  setErrorNotificationTime(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9FA8A3',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  lineHeight: 1,
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {hoveredInputs && typeof window !== "undefined" && document.body && createPortal(
        <div style={{
          position: "fixed",
          left: hoveredInputs.x,
          top: hoveredInputs.y,
          zIndex: 999999,
          width: 360,
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 20px 60px -10px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          border: "1px solid #E8DCC2",
          overflow: "hidden",
          fontFamily: "Inter, sans-serif"
        }}
        onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
        onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredInputs(null), 200); }}
        >
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #003049 0%, #1A4A66 100%)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14 }}>⚙️</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Run Configuration</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>Inputs used for this analysis</div>
              </div>
            </div>
            <button onClick={() => setHoveredInputs(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, width: 24, height: 24, color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>

          {/* Content */}
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, maxHeight: 420, overflowY: "auto" }}>
            {Object.entries(hoveredInputs.data).map(([key, value]) => {
              if (key === 'timestamp' || key === 'session_id') return null;

              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

              const keyIcons: Record<string, string> = {
                action: "⚡", topic: "🎯", keywords: "🔑", countries: "🌍",
                max_ads: "📊", only_active: "✅", query: "🔍"
              };
              const icon = keyIcons[key] || "•";

              let displayValue: React.ReactNode;

              if (Array.isArray(value)) {
                displayValue = (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                    {(value as any[]).map((v, i) => (
                      <span key={i} style={{ padding: "4px 10px", background: "#E7F0F6", color: "#003049", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid #C2D6E2" }}>
                        {v}
                      </span>
                    ))}
                  </div>
                );
              } else if (typeof value === 'boolean') {
                displayValue = (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: value ? "#DCFCE7" : "#FEE2E2", color: value ? "#166534" : "#780000", border: `1px solid ${value ? "#BBF7D0" : "#FECACA"}` }}>
                    {value ? "✓ Enabled" : "✗ Disabled"}
                  </span>
                );
              } else if (typeof value === 'number') {
                displayValue = <span style={{ fontSize: 20, fontWeight: 800, color: "#23394A", display: "block", marginTop: 2 }}>{value}</span>;
              } else {
                displayValue = <span style={{ fontSize: 13, fontWeight: 600, color: "#23394A", display: "block", marginTop: 4, textTransform: "capitalize" }}>{String(value).replace(/_/g, ' ')}</span>;
              }

              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", padding: "10px 12px", background: "#FDF6E3", borderRadius: 10, border: "1px solid #FDF0D5" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#9FA8A3", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
                  </div>
                  {displayValue}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
