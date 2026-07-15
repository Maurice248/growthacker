"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Badge,
  Card,
  MetricCard,
  SectionTitle,
  WorkflowStep,
  EmptyState,
  Spinner,
  SecondaryButton
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
  ClipboardCheck,
  Settings2,
  TrendingUp,
  Activity,
  PieChart,
  Share2,
  Newspaper,
  PenLine,
  Search,
  History,
  Trash2,
  FileText,
  Sparkles,
  Phone,
  Smartphone,
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
  BRAND_ICP_FIELDS,
  BRAND_STRATEGY_FIELDS,
  profileFromDb,
  profileToDb,
  snapshotToProfile,
} from "@/lib/brand-config";
import {
  CLIENT_DASHBOARD_NAVIGATE_EVENT,
  CLIENT_DASHBOARD_SET_TAB_EVENT,
} from "@/lib/client-dashboard-nav";

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
const AD_COMPLETION_POLL_MS = 10_000;

const DEFAULT_BRAND_CONFIG = {
  productsAndServices: "",
  valueProposition: "",
  brandVoice: "",
  positioning: "",
  competitors: "",
  painPoints: "",
  icpMetaAds: "",
  icpNewsletter: "",
  icpOutreach: "",
  destinationUrl: "",
};

const TABS = [
  { id: "profile", label: "Brand Context", icon: User },
  { id: "analysis", label: "Ads Lab", icon: BarChart3 },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "create", label: "Create Ad", icon: WandSparkles },
  { id: "approval", label: "Approval", icon: ClipboardCheck },
  { id: "variants", label: "Generate Ad Variants", icon: Sparkles },
  { id: "campaigns", label: "Campaign Setup", icon: Settings2 },
  { id: "live_campaigns", label: "Running Campaign", icon: TrendingUp },
  { id: "ad_performance", label: "Automated Campaigns", icon: Activity },
  { id: "reports", label: "Reports", icon: PieChart },
];

const SOCIAL_TABS = [
  { id: "social-overview", label: "Overview", icon: LayoutDashboard },
  { id: "social-creator-studio", label: "Creator Studio", icon: Sparkles },
];

const SOCIAL_TAB_IDS = new Set(SOCIAL_TABS.map((t) => t.id));

const NEWSLETTER_TABS = [
  { id: "newsletter-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "newsletter-overview", label: "Settings", icon: Settings2 },
  { id: "newsletter-generate", label: "Generate Newsletter", icon: PenLine },
  { id: "newsletter-campaign", label: "Create Campaign", icon: Megaphone },
  { id: "newsletter-subscribers", label: "Subscribers", icon: User },
  { id: "newsletter-history", label: "History", icon: History },
  { id: "newsletter-services", label: "Manage Services", icon: Settings2 },
];

const NEWSLETTER_TAB_IDS = new Set(NEWSLETTER_TABS.map((t) => t.id));

const META_ADS_IDS = new Set(["overview", "create", "approval", "variants", "campaigns", "live_campaigns", "ad_performance", "reports"]);

const OUTREACH_FUTURE_TABS = [
  { id: "cold-dm", label: "Cold DM", icon: MessageSquare },
  { id: "cold-call", label: "Cold Call", icon: Phone },
  { id: "cold-sms", label: "Cold SMS", icon: Smartphone },
];

const OUTREACH_TABS = [
  { id: "outreach-dashboard", label: "Dashboard", icon: LayoutDashboard },
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
  { id: "blog-post", label: "Blog Posts", icon: FileText },
  { id: "blog-automation", label: "Automation", icon: Sparkles },
];

const BLOG_IDS = new Set(BLOG_TABS.map((t) => t.id));

const ALL_APP_TAB_IDS = new Set([
  ...TABS.map((t) => t.id),
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

const LOCATION_SUGGESTIONS = [
  { name: "United States", shortcut: "US", details: "Country in North America" },
  { name: "Canada", shortcut: "CA", details: "Country in North America" },
  { name: "Turkey", shortcut: "TR", details: "Country in Europe/Asia" },
  { name: "United Kingdom", shortcut: "GB", details: "Country in Europe" },
  { name: "Germany", shortcut: "DE", details: "Country in Europe" },
  { name: "France", shortcut: "FR", details: "Country in Europe" },
  { name: "Australia", shortcut: "AU", details: "Country in Oceania" },
  { name: "United Arab Emirates", shortcut: "AE", details: "Country in Middle East" },
  { name: "India", shortcut: "IN", details: "Country in South Asia" },
  { name: "Spain", shortcut: "ES", details: "Country in Europe" },
  { name: "Italy", shortcut: "IT", details: "Country in Europe" },
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

function AnalysisResultToggle({
  expanded,
  darkText = false,
}: {
  expanded: boolean;
  darkText?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        background: darkText ? "#fff" : "var(--surface, #F8FAFC)",
        border: "1px solid var(--border, #E2E8F0)",
        fontSize: 20,
        fontWeight: 700,
        color: darkText ? "#0F172A" : "var(--text-muted, #64748B)",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {expanded ? "▾" : "▸"}
    </span>
  );
}

function AnalysisCollapsiblePanel({
  expanded,
  onToggle,
  icon,
  title,
  subtitle,
  children,
  marginBottom = 20,
}: {
  expanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  marginBottom?: number;
}) {
  return (
    <div
      style={{
        marginBottom,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #E2E8F0",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          padding: "16px 20px",
          background: "#F8FAFC",
          borderBottom: expanded ? "1px solid #E2E8F0" : "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
        <AnalysisResultToggle expanded={expanded} />
      </div>
      {expanded && children}
    </div>
  );
}

function buildCreateTabConfigFromAnalysis(analysis, prevConfig) {
  const scripts = analysis?.ready_ad_scripts || [];
  const itemCount = Math.max(
    1,
    Math.min(5, scripts.length > 1 ? scripts.length : 1)
  );

  const newItems = [];
  for (let i = 0; i < itemCount; i++) {
    const existing = prevConfig.items[i];
    const id = existing?.id || Date.now() + i;
    const adType = inferAdTypeFromAnalysis(analysis, i);
    const idea = normalizeIdeaForAdType(buildStoryboardFromAnalysis(analysis, i), adType);

    if (adType === "video") {
      newItems.push({
        id,
        type: "video",
        duration: existing?.duration || "28 seconds",
        audioStyle: existing?.audioStyle || "Background Music",
        videoStyle: existing?.videoStyle || "Bold & Colorful",
        language: existing?.language || "English",
        character: existing?.character || "male",
        voiceId: existing?.voiceId || "rTOopItG6FIkKMIVxsl5",
        idea,
      });
    } else {
      newItems.push({
        id,
        type: "image",
        imageStyle: existing?.imageStyle || "Bold & Colorful",
        idea,
      });
    }
  }

  const vCount = newItems.filter((x) => x.type === "video").length;
  const iCount = newItems.filter((x) => x.type === "image").length;
  return {
    totalAds: newItems.length,
    videoCount: vCount,
    imageCount: iCount,
    items: newItems,
  };
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

  // Auto-open Meta Ads group when navigating to one of its tabs
  useEffect(() => { if (META_ADS_IDS.has(tab)) setMetaAdsOpen(true); }, [tab]);

  // Auto-open Outreach group when navigating to one of its tabs
  useEffect(() => { if (OUTREACH_TABS.some((t) => t.id === tab)) setOutreachOpen(true); }, [tab]);

  // Auto-open Newsletter / Blog / Social groups
  useEffect(() => {
    if (NEWSLETTER_TABS.some((t) => t.id === tab)) setNewsletterOpen(true);
    if (SOCIAL_TAB_IDS.has(tab)) setSocialOpen(true);
    if (BLOG_IDS.has(tab)) setBlogOpen(true);
  }, [tab]);

  // Migrate legacy tab ids from localStorage
  useEffect(() => { if (tab === "outreach") setTab("outreach-dashboard"); }, [tab, setTab]);
  useEffect(() => { if (tab === "newsletter") setTab("newsletter-generate"); }, [tab, setTab]);
  useEffect(() => { if (tab === "blog-management") setTab("blog-post"); }, [tab, setTab]);
  useEffect(() => { if (tab === "social-dash") setTab("social-creator-studio"); }, [tab, setTab]);
  useEffect(() => { if (tab === "social-automation") setTab("social-overview"); }, [tab, setTab]);


  // Analysis state — status and data persist across refresh
  const [analysisStatus, setAnalysisStatus] = useLocalStorage("app_analysis_status", "idle");
  // idle | generating | done | error
  const [analysisData, setAnalysisData] = useLocalStorage("app_analysis_data", null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhaseIndex, setAnalysisPhaseIndex] = useState(0);
  const [analysisStatusMessage, setAnalysisStatusMessage] = useState<string>(ANALYSIS_PIPELINE_PHASES[0].status);

  const [analysisError, setAnalysisError] = useState("");
  const [topicAnalysisExpanded, setTopicAnalysisExpanded] = useState(true);
  const [analysisCardsExpanded, setAnalysisCardsExpanded] = useState(COLLAPSED_ANALYSIS_SECTIONS);
  const freshAnalysisResultRef = useRef(false);
  const prevAnalysisDataIdRef = useRef<string | null>(null);
  const [pendingAnalysisTopic, setPendingAnalysisTopic] = useLocalStorage("app_pending_analysis_topic", null);
  const pendingTopicRef = useRef<string | null>(null); // ref so realtime callback always sees latest value
  const companySlugRef = useRef<string | null>(null);
  const analysisInFlightRef = useRef(false);
  const prevTabRef = useRef<string | null>(null);
  useEffect(() => { pendingTopicRef.current = pendingAnalysisTopic; }, [pendingAnalysisTopic]);

  const expandAllAnalysisSections = useCallback(() => {
    setTopicAnalysisExpanded(true);
    setAnalysisCardsExpanded({ ...EXPANDED_ANALYSIS_SECTIONS });
  }, []);

  const expandTopicCollapseResults = useCallback(() => {
    setTopicAnalysisExpanded(true);
    setAnalysisCardsExpanded({ ...COLLAPSED_ANALYSIS_SECTIONS });
  }, []);

  const collapseAllAnalysisSections = useCallback(() => {
    setTopicAnalysisExpanded(false);
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

  const allAnalysisSectionsExpanded = useMemo(() => {
    const resultsExpanded =
      visibleAnalysisSections.length === 0 ||
      visibleAnalysisSections.every((section) => analysisCardsExpanded[section]);
    return topicAnalysisExpanded && resultsExpanded;
  }, [topicAnalysisExpanded, visibleAnalysisSections, analysisCardsExpanded]);

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
  const [researchMaxAds, setResearchMaxAds] = useLocalStorage("app_research_max_ads", 100);
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
  const [adStatus, setAdStatus] = useLocalStorage("app_ad_status", "idle",
    (v) => (v === "generating" ? "idle" : v));
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
  const [stoppedIds, setStoppedIds] = useState([]);
  const [stopStatus, setStopStatus] = useState("idle");
  // idle | stopping | stopped | error

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
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [adCardStatuses, setAdCardStatuses] = useState({});
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(null);
  const [scheduleDates, setScheduleDates] = useState({});

  // ── Ad Videos state ──
  const [adVideosLoading, setAdVideosLoading] = useState(true); // true on mount so skeleton shows until first load

  // ── Supabase reports state ──
  const [sbRows, setSbRows] = useState([]);
  const [adsLabView, setAdsLabView] = useState<"analysis" | "pastRuns">("analysis");

  // Topic for Analysis defaults to expanded when entering Ads Lab or switching sub-tabs
  useEffect(() => {
    if (tab === "analysis" && adsLabView === "analysis") {
      setTopicAnalysisExpanded(true);
    }
  }, [tab, adsLabView]);

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
      { id: Date.now(), type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", language: "English", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" }
    ]
  });
  const [createTabConfigOpen, setCreateTabConfigOpen] = useState(false);
  const [pendingAds, setPendingAds] = useState([]);
  const [adTableLinks, setAdTableLinks] = useState({});
  // Stores { "1": { text: "...", format: "Video", Approved: bool }, ... }
  const [allApprovedAds, setAllApprovedAds] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
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

  // Custom Media Upload
  const [customUploadLoading, setCustomUploadLoading] = useState(false);
  const [customUploadError, setCustomUploadError] = useState("");

  // Live Campaigns State
  const [liveCampaigns, setLiveCampaigns] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState(new Set());
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

  function openCreateAdFromAnalysis() {
    if (!analysisData) return;
    clearCreateTabGenerationState();
    setCreateTabAdsConfig(
      buildCreateTabConfigFromAnalysis(analysisData, {
        totalAds: 1,
        videoCount: 0,
        imageCount: 0,
        items: [],
      })
    );
    setCreateTabConfigOpen(true);
    setTab("create");
  }

  function resetCreateTabWorkspace() {
    clearCreateTabGenerationState();
    setCreateTabAdsConfig({
      totalAds: 1,
      videoCount: 1,
      imageCount: 0,
      items: [
        { id: Date.now(), type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", language: "English", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" }
      ]
    });
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
    addSbToast("Template selected for Ads Lab", "success");
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
        setActiveBrandSnapshot({
          id: result.snapshot.id,
          label: result.snapshot.label || name,
          created_at: result.snapshot.created_at,
          data,
        });
        setProfileData({ ...DEFAULT_BRAND_CONFIG, ...data });
        fetchBrandSnapshots();
        setIsEditingProfile(false);
        addSbToast(`Template "${name}" saved and selected for Ads Lab`, "success");
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

      if (activeBrandSnapshot.data) return;

      setActiveBrandSnapshot({
        ...activeBrandSnapshot,
        label: snapshot.label || activeBrandSnapshot.label,
        created_at: snapshot.created_at,
        data: snapshotToProfile(snapshot),
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

  const displayProfileData = useMemo(() => {
    if (isEditingProfile) return profileData;
    if (isActiveSavedTemplate) {
      return { ...DEFAULT_BRAND_CONFIG, ...activeBrandSnapshot.data };
    }
    return profileData;
  }, [isEditingProfile, isActiveSavedTemplate, activeBrandSnapshot?.data, profileData]);

  const handleStartEditingProfile = () => {
    if (isActiveSavedTemplate) {
      setProfileData({ ...DEFAULT_BRAND_CONFIG, ...activeBrandSnapshot.data });
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

        const data = snapshotToProfile(result.snapshot);
        setActiveBrandSnapshot({
          ...activeBrandSnapshot,
          data,
        });
        setProfileData({ ...DEFAULT_BRAND_CONFIG, ...data });
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
    const validPending = [];
    const hasStorageIndex = storageLookup.size > 0;
    let hiddenMissingMedia = 0;


    // Process DB data
    (dbData || []).forEach(row => {
      const normalizedText = normalizeSupabaseUrl(row.text);
      if (!normalizedText) return;

      const fileName = getStorageFileName(normalizedText);
      const storageInfo = fileName ? storageLookup.get(fileName) : undefined;

      // Skip variant / automated-campaign challengers (reviewed in their own tabs)
      if (fileName && automationExcludedFilenames.has(fileName)) return;

      // Skip rows whose file was deleted from Supabase storage
      if (hasStorageIndex && fileName && !storageInfo) {
        hiddenMissingMedia += 1;
        return;
      }

      // We prioritize the database record. If storageLookup found it, we use the storage URL.
      const finalUrl = storageInfo ? storageInfo.publicUrl : normalizedText;
      const entry = { ...row, originalText: row.text, text: finalUrl };

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

    setAdTableLinks(latest);
    setAllApprovedAds(approvedList);
    setMissingMediaKeys(new Set());

    if (hiddenMissingMedia > 0) {
      addSbToast(
        `${hiddenMissingMedia} ad${hiddenMissingMedia === 1 ? "" : "s"} hidden — media no longer in Supabase storage.`,
        "info"
      );
    }

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
    videoGenPollRef.current = setInterval(async () => {
      if (Date.now() - genStart > VIDEO_GEN_DURATION) {
        clearInterval(videoGenPollRef.current);
        setGenerationActive(false);
        generationActiveRef.current = false;
        videoGeneratingRef.current = false;
        setVideoGenerating(false);
        setVideoGenProgress(0);
        window.localStorage.removeItem("app_video_gen_start");
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
    const stored = window.localStorage.getItem("app_video_gen_start");
    if (!stored) return;
    const start = Number(stored);
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
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // When returning to Ads Lab, sync any completed report and reset section layout
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
            newItems.push({ id: Date.now() + i, type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", language: "English", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" });
          } else {
            // Check if we can add image
            const iCount = newItems.filter(x => x.type === "image").length;
            if (iCount < 2) {
              newItems.push({ id: Date.now() + i, type: "image", imageStyle: "Bold & Colorful", idea: "" });
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
      // Clear generated ideas and pending state for this item on type switch
      setSentIdeaIds(s => { const n = { ...s }; delete n[itemId]; return n; });
      setGeneratedIdeas(g => { const n = { ...g }; delete n[itemId]; return n; });

      const newItems = [...prev.items];
      if (type === "video") {
        newItems[idx] = { id: itemId, type: "video", duration: "28 seconds", audioStyle: "Background Music", videoStyle: "Bold & Colorful", language: "English", idea: "", character: "male", voiceId: "rTOopItG6FIkKMIVxsl5" };
      } else {
        newItems[idx] = { id: itemId, type: "image", imageStyle: "Bold & Colorful", idea: "" };
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
      addSbToast("Ad approved successfully!");
      await fetchAdTableLinks();
    } catch (error) {
      console.error("Approval error:", error);
      addSbToast(`Approval failed: ${error.message || "Unknown error"}`, "error");
    }

    setApprovingId(null);
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

    const oldJson = typeof ad["json data"] === "string" ? JSON.parse(ad["json data"]) : (ad["json data"] || {});

    // Construct the new schema
    const updatedJsonData = {
      campaign: {
        name: editingAdData.campaignName || (oldJson.campaign?.name || "Untitled Campaign")
      },
      ad: {
        id: oldJson.ad?.id || oldJson.ads?.[0]?.id || Date.now(),
        name: editingAdData.adName || (oldJson.ad?.name || oldJson.ads?.[0]?.name || "Untitled Ad"),
        type: oldJson.ad?.type || oldJson.ads?.[0]?.type || "video",
        headline: editingAdData.headline || (oldJson.ad?.headline || oldJson.ads?.[0]?.headline || "No headline provided."),
        primary_text: editingAdData.primaryText ?? (oldJson.ad?.primary_text || oldJson.ads?.[0]?.primary_text || ""),
        call_to_action_type: editingAdData.ctaType || (oldJson.ad?.call_to_action_type || oldJson.ads?.[0]?.call_to_action_type || "WATCH_MORE"),
        website_url: editingAdData.linkData || (oldJson.ad?.website_url || oldJson.link_data || ad.text || "")
      },
      link_data: editingAdData.linkData || (oldJson.link_data || ad.text || "")
    };

    const { error } = await supabase
      .from("your_name_table")
      .update({ "json data": JSON.stringify(updatedJsonData) })
      .match({ id: ad.id, time: ad.time });

    if (error) {
      console.error("Save error:", error);
      addSbToast("Failed to save changes", "error");
    } else {
      addSbToast("Changes saved successfully!");
      setIsEditingAd(false);
      await fetchAdTableLinks();
    }
    setIsSavingAd(false);
  }




  async function handleRefreshAdVideos() {
    await fetchAdTableLinks();
  }

  async function pollKieTasks(taskIds: string[], maxRetries = 8) {
    if (!taskIds.length) return [];
    let results: any[] = [];
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch(CREATE_AD_KIE_POLL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "KIE poll failed");
      results = data.results || [];
      if (data.allComplete) return results;
      await new Promise((r) => setTimeout(r, attempt < 2 ? 20_000 : 30_000));
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

  async function runClientVideoGeneration(
    generatedPrompts: Record<string, any[]>,
    audioKeys: Record<string, string> = {},
    audioUrls: Record<string, string> = {}
  ) {
    const responses: any[] = [];
    for (const [itemId, scenes] of Object.entries(generatedPrompts)) {
      if (!Array.isArray(scenes) || scenes.length === 0) continue;

      const imgRes = await fetch(CREATE_AD_VIDEO_IMAGES_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes }),
      });
      const imgData = await imgRes.json();
      if (!imgRes.ok) throw new Error(imgData.error || "Scene image generation failed");

      const imagePoll = await pollKieTasks((imgData.tasks || []).map((t: any) => t.taskId));
      const matchImgRes = await fetch(CREATE_AD_VIDEO_IMAGES_MATCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
          pollResults: imagePoll,
          taskPrompts: (imgData.tasks || []).map((t: any) => t.prompt),
        }),
      });
      const matchImgData = await matchImgRes.json();
      if (!matchImgRes.ok) throw new Error(matchImgData.error || "Scene image match failed");
      const scenesWithImages = matchImgData.scenes || scenes;

      const clipRes = await fetch(CREATE_AD_VIDEO_CLIPS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: scenesWithImages }),
      });
      const clipData = await clipRes.json();
      if (!clipRes.ok) throw new Error(clipData.error || "Scene clip generation failed");

      const clipPoll = await pollKieTasks((clipData.tasks || []).map((t: any) => t.taskId));
      const matchClipRes = await fetch(CREATE_AD_VIDEO_CLIPS_MATCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenesWithImages,
          tasks: clipData.tasks || [],
          pollResults: clipPoll,
        }),
      });
      const matchClipData = await matchClipRes.json();
      if (!matchClipRes.ok) throw new Error(matchClipData.error || "Scene clip match failed");
      const scenesWithVideos = matchClipData.scenes || scenesWithImages;

      const response = buildSceneGenerationResponse(scenesWithVideos, imagePoll, clipPoll);
      if (response.failCount === 0) {
        const stitchRes = await fetch(CREATE_AD_VIDEO_STITCH_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenes: scenesWithVideos,
            report_data: analysisData,
            ads_config: createTabAdsConfig,
            audioKey: audioKeys[itemId] || "",
            audioUrl: audioUrls[itemId] || "",
            itemId: Number(itemId),
          }),
        });
        const stitchData = await stitchRes.json().catch(() => ({}));
        if (!stitchRes.ok) {
          throw new Error(stitchData.error || "Video stitch failed");
        }
      }
      responses.push(response);
    }
    return responses;
  }

  async function runImageAdPipeline() {
    const conceptsRes = await fetch(CREATE_AD_IMAGE_CONCEPTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_data: analysisData,
        ads_config: createTabAdsConfig,
      }),
    });
    const conceptsData = await conceptsRes.json();
    if (!conceptsRes.ok) throw new Error(conceptsData.error || "Image concept generation failed");

    const generateRes = await fetch(CREATE_AD_IMAGE_GENERATE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concepts: conceptsData.concepts || [] }),
    });
    const generateData = await generateRes.json();
    if (!generateRes.ok) throw new Error(generateData.error || "Image generation start failed");

    const taskIds = (generateData.tasks || []).map((t: any) => t.taskId);
    const pollResults = await pollKieTasks(taskIds);

    const finalizeRes = await fetch(CREATE_AD_IMAGE_FINALIZE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concepts: conceptsData.concepts || [],
        pollResults,
        report_data: analysisData,
        ads_config: createTabAdsConfig,
      }),
    });
    const finalizeData = await finalizeRes.json();
    if (!finalizeRes.ok) throw new Error(finalizeData.error || "Image finalize failed");
    return finalizeData;
  }

  async function handleCreateTabTriggerAds() {
    if (!analysisData) {
      addSbToast("No analysis data available. Run Ads Lab first.", "error");
      return;
    }
    const config = createTabAdsConfig;

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
    const PROMPT_GEN_DURATION = 540_000; // 9 min
    const promptStart = Date.now();
    setPromptGenProgress(0);
    clearInterval(promptGenTimerRef.current);
    promptGenTimerRef.current = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - promptStart) / PROMPT_GEN_DURATION) * 100);
      setPromptGenProgress(Math.round(pct));
      if (Date.now() - promptStart >= PROMPT_GEN_DURATION) clearInterval(promptGenTimerRef.current);
    }, 2000);

    try {
      const res = await fetch(CREATE_AD_VIDEO_PROMPTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: analysisData?.id || crypto.randomUUID(),
          report_data: analysisData,
          ads_config: config,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate video prompts");

      const scenesMap: any = {};
      const audioKeysMap: any = {};
      const audioUrlsMap: any = {};
      config.items.forEach((item: any, idx: number) => {
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
      addSbToast("Ad prompts generated! Click \"View Prompts\" on each ad.", "success");
    } catch (e: any) {
      setAdStatus("error");
      setWebhookError(e.message || "Failed to reach webhook");
      addSbToast("Failed to generate ad prompts. Try again.", "error");
    } finally {
      setAdScenesGenerating({});
      clearInterval(promptGenTimerRef.current);
      setPromptGenProgress(0);
    }
  }

  function startVideoGenProgress() {
    const start = Date.now();
    videoGenStartRef.current = start;
    videoGeneratingRef.current = true;
    generationHandledRef.current = false;
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

  /** IMAGE — native pipeline with client-side polling */
  async function handleImageGenerate() {
    const item = createTabAdsConfig.items[0];
    if (!item) return;

    setImageGenerating(true);
    imageGeneratingRef.current = true;
    setImageGenProgress(0);
    setFailedPrompts([]);

    const IMAGE_MAX = 300_000;
    const imgStart = Date.now();
    clearInterval(imageGenTimerRef.current);
    imageGenTimerRef.current = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - imgStart) / IMAGE_MAX) * 100);
      setImageGenProgress(Math.round(pct));
      if (Date.now() - imgStart >= IMAGE_MAX) {
        clearInterval(imageGenTimerRef.current);
        clearInterval(videoGenPollRef.current);
        setImageGenerating(false);
        setImageGenProgress(0);
        addSbToast("Image generation may still be running. Check Ad Previews to see results.", "info");
      }
    }, 2000);

    try {
      await runImageAdPipeline();
      setImageGenProgress(100);
      addSbToast("Image ad generated successfully!", "success");
      await fetchAdTableLinks();
      resetCreateTabWorkspace();
    } catch (e: any) {
      addSbToast(e?.message || "Image generation failed.", "error");
    } finally {
      clearInterval(imageGenTimerRef.current);
      setImageGenerating(false);
      imageGeneratingRef.current = false;
      setImageGenProgress(0);
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
      scene_index_map: indexMap.map(m => ({ itemId: m.itemId, sceneIndex: m.sceneIndex })),
    };

    // ── IMMEDIATE: unblock UI, start progress bar, keep workspace cards visible ──
    setAcceptingPrompts(false);
    setGenerationActive(true);
    generationActiveRef.current = true;
    setFailedPrompts([]);
    startVideoGenProgress();
    addSbToast("✅ Prompts accepted! Generation started — cards will update when done.", "success");

    // ── BACKGROUND: run native video pipeline ──
    runClientVideoGeneration(payload.generated_prompts, payload.audioKeys, payload.audioUrls)
      .then((responseData) => {
        const failures = parseGenerationFailures(responseData, indexMap);
        const successes = parseGenerationSuccesses(responseData, indexMap);
        if (successes.length > 0) {
          setCompletedItemIds(prev => [...new Set([...prev, ...successes])]);
        }
        if (failures.length > 0) {
          stopVideoGenProgress(false);
          setGenerationActive(false);
          generationActiveRef.current = false;
          setFailedPrompts(failures);
          addSbToast(`⚠️ ${failures.length} scene(s) failed. Click the red card to view and fix prompts.`, "error");
        } else {
          stopVideoGenProgress(true);
          setGenerationActive(false);
          generationActiveRef.current = false;
          fetchAdTableLinks();
          addSbToast("✅ Video generation complete! Check Ad Previews.", "success");
        }
      })
      .catch((err: any) => {
        stopVideoGenProgress(false);
        setGenerationActive(false);
        generationActiveRef.current = false;
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
      generated_prompts: scenesForRequest,
      audioKeys: adAudioKeysMap,
      audio_keys: adAudioKeysMap,
      audioUrls: adAudioUrlsMap,
      is_retry: true,
      scene_index_map: newIndexMap.map(m => ({ itemId: m.itemId, sceneIndex: m.sceneIndex })),
    };

    runClientVideoGeneration(payload.generated_prompts, payload.audioKeys, payload.audioUrls)
      .then((responseData) => {
        const failures = parseGenerationFailures(responseData, newIndexMap);
        const successes = parseGenerationSuccesses(responseData, newIndexMap);
        if (successes.length > 0) setCompletedItemIds(prev => [...new Set([...prev, ...successes])]);
        if (failures.length > 0) {
          stopVideoGenProgress(false);
          setGenerationActive(false);
          generationActiveRef.current = false;
          setFailedPrompts(failures);
          addSbToast(`⚠️ ${failures.length} scene(s) failed again. Fix and retry.`, "error");
        } else {
          stopVideoGenProgress(true);
          setGenerationActive(false);
          generationActiveRef.current = false;
          fetchAdTableLinks();
        }
      })
      .catch(() => {
        stopVideoGenProgress(false);
        setGenerationActive(false);
        generationActiveRef.current = false;
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
      generated_prompts: { [itemId]: updatedScenes },
      audioKeys: adAudioKeysMap,
      audio_keys: adAudioKeysMap,
      audioUrls: adAudioUrlsMap,
      is_retry: true,
      scene_index_map: indexMap.map(m => ({ itemId: m.itemId, sceneIndex: m.sceneIndex })),
    };

    runClientVideoGeneration(payload.generated_prompts, payload.audioKeys, payload.audioUrls)
      .then((responseData) => {
        clearInterval(retryGenTimerRef.current);
        const newFailures = responseData ? parseGenerationFailures(responseData, indexMap) : [];
        const newSuccesses = responseData ? parseGenerationSuccesses(responseData, indexMap) : [];
        if (newSuccesses.length > 0) {
          setCompletedItemIds(prev => [...new Set([...prev, ...newSuccesses])]);
        }
        setFailedPrompts((prev: any[]) => {
          const others = prev.filter(f => String(f.itemId) !== itemId);
          const updated = [...others, ...newFailures];
          if (updated.length === 0) setTimeout(() => resetCreateTabWorkspace(), 1000);
          return updated;
        });
        if (newFailures.length === 0) {
          setRetryItemProgress(100);
          setTimeout(() => { setRetryItemProgress(0); setRetryingItemId(null); }, 1500);
          addSbToast("✅ Retry successful! Check Ad Previews.", "success");
          fetchAdTableLinks();
        } else {
          setRetryItemProgress(0);
          setRetryingItemId(null);
          addSbToast(`⚠️ ${newFailures.length} scene(s) still failing. Edit and retry again.`, "error");
        }
      })
      .catch(() => {
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
      generated_prompts: retryScenesMap,
      audioKeys: adAudioKeysMap,
      audio_keys: adAudioKeysMap,
      audioUrls: adAudioUrlsMap,
      is_retry: true,
      scene_index_map: newIndexMap.map(m => ({ itemId: m.itemId, sceneIndex: m.sceneIndex })),
    };

    runClientVideoGeneration(payload.generated_prompts, payload.audioKeys, payload.audioUrls)
      .then((responseData) => {
        clearInterval(retryGenTimerRef.current);
        const newFailures = responseData ? parseGenerationFailures(responseData, newIndexMap) : [];
        if (newFailures.length > 0) {
          setFailedPrompts(newFailures);
          setRetryGenProgress(0);
          addSbToast(`⚠️ ${newFailures.length} still failing. Edit and retry again.`, "error");
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
        setRetryGenActive(false);
      })
      .catch(() => {
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
    boxShadow: tab === id ? "0 1px 3px rgba(37,99,235,0.12)" : "none",
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
          width: sidebarCollapsed ? 68 : 260,
          background: "var(--card-bg)",
          borderRight: "1px solid var(--border)",
          padding: sidebarCollapsed ? "20px 10px" : "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          zIndex: 100,
          transition: "width 0.25s ease, padding 0.25s ease",
        }}
      >
        {/* Brand + Toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", gap: 8, paddingBottom: 14, borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
            <img
              src="/tenant-report-logo.png"
              alt="Tenant Report AI"
              style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", objectFit: "contain", background: "#fff", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.10)", cursor: "pointer" }}
              onClick={() => setSidebarCollapsed((v: boolean) => !v)}
            />
            {!sidebarCollapsed && (
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden" }}>
                Tenant Report AI
              </div>
            )}
          </div>
          {/* Toggle button — only on desktop */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed((v: boolean) => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--surface)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
              color: "var(--text-muted)", fontSize: 11, transition: "all 0.15s",
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--primary-light)"; e.currentTarget.style.color = "var(--primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-muted)"; }}
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
                    padding: sidebarCollapsed ? "10px 0" : indent ? "8px 12px 8px 28px" : "9px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    fontSize: indent ? 12 : 13,
                    fontWeight: tab === t.id ? 700 : 500,
                    textAlign: "left",
                    cursor: "pointer",
                    background: tab === t.id ? "var(--primary-light)" : "transparent",
                    color: tab === t.id ? "var(--primary-dark)" : "var(--text-muted)",
                    transition: "all 0.18s ease",
                    boxShadow: tab === t.id ? "0 1px 3px rgba(37,99,235,0.12)" : "none",
                    position: "relative",
                    overflow: "hidden",
                    fontFamily: "inherit",
                  }}
                  onClick={() => {
                    if (t.externalLink) { window.open(t.externalLink, "_blank", "noopener,noreferrer"); }
                    else if ("internalPath" in t && t.internalPath) { router.push(t.internalPath); setMobileMenuOpen(false); }
                    else { setTab(t.id); setMobileMenuOpen(false); }
                  }}
                  onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.background = "var(--surface-hover)"; }}
                  onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.background = "transparent"; }}
                >
                  {(() => { const Icon = t.icon; return <Icon size={indent ? 13 : 15} style={{ flexShrink: 0 }} />; })()}
                  {!sidebarCollapsed && (
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
                  )}
                  {tab === t.id && (
                    <span style={{ position: "absolute", left: 0, top: "20%", width: 3, height: "60%", borderRadius: "0 3px 3px 0", background: "var(--primary)" }} />
                  )}
                </button>
                {sidebarCollapsed && (
                  <span className="sidebar-tooltip" style={{
                    position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                    background: "#1e293b", color: "#fff", fontSize: 11, fontWeight: 600,
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
                {/* Brand (top) */}
                {renderTabBtn(TABS.find(t => t.id === "profile")!)}

                {/* Ads Lab */}
                {renderTabBtn(TABS.find(t => t.id === "analysis")!)}

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
                      padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                      borderRadius: showMetaAdsChildren ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                      border: "none",
                      fontSize: 13,
                      fontWeight: metaAdsActive ? 700 : 500,
                      textAlign: "left",
                      cursor: "pointer",
                      background: metaAdsActive ? "var(--primary-light)" : showMetaAdsChildren ? "var(--surface)" : "transparent",
                      color: metaAdsActive ? "var(--primary-dark)" : showMetaAdsChildren ? "var(--text)" : "var(--text-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => setMetaAdsOpen(o => !o)}
                    onMouseEnter={e => { if (!metaAdsActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!metaAdsActive) e.currentTarget.style.background = showMetaAdsChildren ? "var(--surface)" : "transparent"; }}
                  >
                    <Megaphone size={15} style={{ flexShrink: 0 }} />
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
                    {metaAdsActive && (
                      <span style={{ position: "absolute", left: 0, top: "20%", width: 3, height: "60%", borderRadius: "0 3px 3px 0", background: "var(--primary)" }} />
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#1e293b", color: "#fff", fontSize: 11, fontWeight: 600,
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
                      background: "var(--surface)",
                      borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                      borderTop: "1px solid var(--border-light)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {TABS.filter(t => META_ADS_IDS.has(t.id)).map(t => renderTabBtn(t, true))}
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
                      background: socialActive ? "var(--primary-light)" : showSocialChildren ? "var(--surface)" : "transparent",
                      color: socialActive ? "var(--primary-dark)" : showSocialChildren ? "var(--text)" : "var(--text-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => setSocialOpen(o => !o)}
                    onMouseEnter={e => { if (!socialActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!socialActive) e.currentTarget.style.background = showSocialChildren ? "var(--surface)" : "transparent"; }}
                  >
                    <Share2 size={15} style={{ flexShrink: 0 }} />
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
                      background: "#1e293b", color: "#fff", fontSize: 11, fontWeight: 600,
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
                      background: "var(--surface)",
                      borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                      borderTop: "1px solid var(--border-light)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {SOCIAL_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>

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
                      background: newsletterActive ? "var(--primary-light)" : showNewsletterChildren ? "var(--surface)" : "transparent",
                      color: newsletterActive ? "var(--primary-dark)" : showNewsletterChildren ? "var(--text)" : "var(--text-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => setNewsletterOpen(o => !o)}
                    onMouseEnter={e => { if (!newsletterActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!newsletterActive) e.currentTarget.style.background = showNewsletterChildren ? "var(--surface)" : "transparent"; }}
                  >
                    <Newspaper size={15} style={{ flexShrink: 0 }} />
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
                      background: "var(--surface)",
                      borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                      borderTop: "1px solid var(--border-light)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {NEWSLETTER_TABS.map(t => renderTabBtn(t, true))}
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
                      background: outreachActive ? "var(--primary-light)" : showOutreachChildren ? "var(--surface)" : "transparent",
                      color: outreachActive ? "var(--primary-dark)" : showOutreachChildren ? "var(--text)" : "var(--text-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => setOutreachOpen(o => !o)}
                    onMouseEnter={e => { if (!outreachActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!outreachActive) e.currentTarget.style.background = showOutreachChildren ? "var(--surface)" : "transparent"; }}
                  >
                    <Send size={15} style={{ flexShrink: 0 }} />
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
                    {outreachActive && (
                      <span style={{ position: "absolute", left: 0, top: "20%", width: 3, height: "60%", borderRadius: "0 3px 3px 0", background: "var(--primary)" }} />
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#1e293b", color: "#fff", fontSize: 11, fontWeight: 600,
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
                      background: "var(--surface)",
                      borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                      borderTop: "1px solid var(--border-light)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {OUTREACH_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>

                {OUTREACH_FUTURE_TABS.map((t) => renderTabBtn(t))}

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
                      background: blogActive ? "var(--primary-light)" : showBlogChildren ? "var(--surface)" : "transparent",
                      color: blogActive ? "var(--primary-dark)" : showBlogChildren ? "var(--text)" : "var(--text-muted)",
                      transition: "all 0.18s ease",
                      fontFamily: "inherit",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onClick={() => setBlogOpen(o => !o)}
                    onMouseEnter={e => { if (!blogActive) e.currentTarget.style.background = "var(--surface-hover)"; }}
                    onMouseLeave={e => { if (!blogActive) e.currentTarget.style.background = showBlogChildren ? "var(--surface)" : "transparent"; }}
                  >
                    <FileText size={15} style={{ flexShrink: 0 }} />
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
                    {blogActive && (
                      <span style={{ position: "absolute", left: 0, top: "20%", width: 3, height: "60%", borderRadius: "0 3px 3px 0", background: "var(--primary)" }} />
                    )}
                  </button>
                  {sidebarCollapsed && (
                    <span className="sidebar-tooltip" style={{
                      position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)",
                      background: "#1e293b", color: "#fff", fontSize: 11, fontWeight: 600,
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
                      background: "var(--surface)",
                      borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                      borderTop: "1px solid var(--border-light)",
                      paddingBottom: 4,
                      overflow: "hidden",
                    }}>
                      {BLOG_TABS.map(t => renderTabBtn(t, true))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </nav>

        {/* Sidebar Footer (User Profile & Sign Out) */}
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 16 }}>
          {user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!sidebarCollapsed && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--primary-light)", border: "2px solid var(--primary-mid)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", flexShrink: 0 }}>
                    <User size={13} />
                  </div>
                  <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                  </div>
                </div>
              )}
              <button
                onClick={handleSignOut}
                title={sidebarCollapsed ? "Sign Out" : ""}
                style={{
                  padding: "8px", borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)", background: "var(--card-bg)",
                  color: "var(--red)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.15s", fontFamily: "inherit", width: "100%"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red-light)"; e.currentTarget.style.borderColor = "var(--red)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card-bg)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <LogOut size={13} /> {!sidebarCollapsed && "Sign Out"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/login")}
              style={{
                padding: "9px 12px", borderRadius: "var(--radius-md)",
                border: "none", background: "var(--primary)",
                color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
                transition: "all 0.15s", fontFamily: "inherit", width: "100%"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary-dark)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(37,99,235,0.35)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.25)"; }}
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
        className="main-layout-content"
        style={{
          flex: 1,
          padding: embed ? "16px" : "24px 32px 4rem",
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "hidden",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >

      {/* ═══════════════════════════════════════════════════════
          OVERVIEW
      ═══════════════════════════════════════════════════════ */}
      {tab === "overview" && (() => {
        // Compute dynamic top statistics
        const activeCampaigns = metaCampaignInsights.filter(c => c.effective_status === 'ACTIVE').length;
        const totalCampaignsRendered = activeCampaigns || campaigns.length; // fallback
        const pendingAuthCount = (adData?.ad_scripts || []).filter(a => getAdStatus(a.id) === "pending").length;

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

        return (
          <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
            {/* Top Stat Ribbon */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
              style={{ marginBottom: 40 }}
            >
              <MetricCard
                label="Live campaigns"
                value={totalCampaignsRendered}
                sub="Meta Ads API"
                color="var(--primary)"
                bg="var(--primary-light)"
              />
              <MetricCard
                label="Market Intel"
                value={sbRows.length}
                sub="Available reports"
                color="var(--green)"
                bg="var(--green-light)"
              />
              <MetricCard
                label="Pending approval"
                value={pendingAuthCount}
                sub={pendingAuthCount > 0 ? "Action needed" : "All clear"}
                color={pendingAuthCount > 0 ? "var(--red)" : "var(--amber)"}
                bg={pendingAuthCount > 0 ? "var(--red-light)" : "var(--amber-light)"}
                dot={pendingAuthCount > 0}
              />
              <MetricCard
                label="Stopped"
                value={stoppedIds.length}
                sub="This session"
                color="var(--text-muted)"
                bg="var(--surface)"
              />
            </div>

            {/* Dash Body Panels */}
            <div
              className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4"
            >
              {/* Left Column */}
              <div className="overview-left-col" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Account Health Window */}
                <Card className="account-health-card" style={{ background: "linear-gradient(135deg, #f8fafc, #eff6ff)", border: "1px solid #bfdbfe", padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <SectionTitle style={{ margin: 0, color: "var(--primary)" }}>Account Health Snapshot</SectionTitle>
                    <Badge text="Live Data" color="var(--primary)" bg="var(--primary-light)" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {[
                      { label: "Total Inv.", value: `$${spendTotal.toFixed(2)}`, color: "var(--text)" },
                      { label: "Total Reach", value: impressionsTotal.toLocaleString(), color: "var(--text)" },
                      { label: "Avg CPM", value: `$${cpm}`, color: "var(--primary)" },
                    ].map((stat) => (
                      <div key={stat.label} style={{ background: "#ffffff", padding: "12px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Top Performer Campaign */}
                <Card style={{ position: "relative", overflow: "hidden", border: "1px solid #bbf7d0", background: "#f0fdf4" }}>
                  <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.1 }}>🏆</div>
                  <SectionTitle style={{ color: "var(--green-strong)" }}>Top Performing Campaign</SectionTitle>

                  {topPerformer ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "lowercase", display: "inline-block", background: "rgba(0,0,0,0.05)", padding: "2px 8px", borderRadius: 4 }}>{topPerformer.objective?.replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>{topPerformer.name}</div>

                      <div className="flex flex-col sm:flex-row gap-4 lg:gap-5">
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Spend</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>${parseFloat(topPerformer.insights?.spend || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>CTR (Link)</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)" }}>{parseFloat(topPerformer.insights?.inline_link_click_ctr || 0).toFixed(2)}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Conversions</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{topPerformer.insights?.leads || 0}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: "20px 0", fontSize: 13, color: "var(--text-muted)" }}>No campaigns are currently tracking performance data.</div>
                  )}
                </Card>

              </div>

              {/* Right Column: Quick Actions */}
              <div className="overview-right-col" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Card>
                  <SectionTitle>Quick Actions</SectionTitle>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {[
                      ["Run competitor analysis", () => setTab("analysis"), "◎", "Assess competitive blind spots in the market."],
                      ["Create new ad setup", () => setTab("create"), "◈", "Generate scripts and creative logic using AI."],
                      ["Review approvals queue", () => setTab("approval"), "◉", "Finalize ad creatives and prepare launch configurations."],
                      ["Monitor live tracking", () => setTab("reports"), "◧", "Review granular performance tables inside Reports."],
                    ].map(([label, fn, icon, sub]: any, i) => (
                      <button
                        key={i}
                        onClick={fn}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border)",
                          background: "#fff",
                          color: "var(--text)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.15s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--surface-hover)";
                          e.currentTarget.style.borderColor = "var(--primary-light)";
                          e.currentTarget.style.transform = "translateX(2px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#fff";
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.transform = "translateX(0)";
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 13, color: "var(--primary-strong)" }}>
                            <span style={{ fontSize: 14 }}>{icon}</span> {label}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, marginLeft: 24 }}>{sub}</div>
                        </div>
                        <span style={{ opacity: 0.4, paddingLeft: 10 }}>→</span>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          ADS ANALYSIS
      ═══════════════════════════════════════════════════════ */}
      {tab === "analysis" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "0 24px" }}>

          {/* ── Page Header ── */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 20, padding: "20px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            {/* Left: title + description */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 26 }}>🔍</span>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Competitor Ad Analysis</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>Research competitor ads, find gaps, and get ready-to-use ad scripts powered by AI</div>
              </div>
            </div>
          </div>

          {/* ── Ads Lab Sub-tabs ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, padding: "4px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, width: "fit-content" }}>
              {([
                { id: "analysis" as const, label: "Analysis" },
                { id: "pastRuns" as const, label: "Past Runs", count: sbRows.length },
              ]).map((viewTab) => {
                const isActive = adsLabView === viewTab.id;
                return (
                  <button
                    key={viewTab.id}
                    type="button"
                    onClick={() => setAdsLabView(viewTab.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      background: isActive ? "var(--primary-light)" : "transparent",
                      color: isActive ? "var(--primary-dark)" : "var(--text-muted)",
                      boxShadow: isActive ? "0 1px 3px rgba(37,99,235,0.12)" : "none",
                      transition: "all 0.18s ease",
                    }}
                  >
                    {viewTab.label}
                    {viewTab.count != null && viewTab.count > 0 && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 20,
                        background: isActive ? "var(--primary-mid)" : "#E2E8F0",
                        color: isActive ? "var(--primary-dark)" : "#64748B",
                      }}>
                        {viewTab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {adsLabView === "analysis" && (
              <button
                type="button"
                onClick={toggleAllAnalysisSections}
                title={allAnalysisSectionsExpanded ? "Collapse all sections" : "Expand all sections"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", letterSpacing: "0.04em" }}>
                  {allAnalysisSectionsExpanded ? "Collapse All" : "Expand All"}
                </span>
                <AnalysisResultToggle expanded={allAnalysisSectionsExpanded} darkText />
              </button>
            )}
          </div>

          {adsLabView === "analysis" && (
          <div>
            <Card style={{ marginBottom: 14 }}>
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
              <div
                role="button"
                tabIndex={0}
                onClick={() => setTopicAnalysisExpanded((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setTopicAnalysisExpanded((v) => !v);
                  }
                }}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                <SectionTitle
                  style={{ marginBottom: topicAnalysisExpanded ? 16 : 0 }}
                  action={
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        lineHeight: 1,
                      }}
                    >
                      {topicAnalysisExpanded ? "▾" : "▸"}
                    </span>
                  }
                >
                  Topic for analysis
                </SectionTitle>
              </div>
              {topicAnalysisExpanded && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  marginBottom: 24,
                  background: "var(--surface)",
                  padding: 20,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Keywords Tag Manager */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 8,
                    }}
                  >
                    Keywords (Press Enter or click Add to append)
                  </label>
                  
                  {/* Selected Keywords list as beautiful tags */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 10,
                      padding: 8,
                      background: "var(--card-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      minHeight: "45px",
                    }}
                  >
                    {researchKeywords.map((kw, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 12px",
                          background: "var(--primary-light)",
                          border: "1px solid var(--primary-mid)",
                          borderRadius: "var(--radius-pill)",
                          color: "var(--primary-dark)",
                          fontSize: 13,
                          fontWeight: 500,
                          transition: "all 0.15s ease",
                        }}
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => {
                            setResearchKeywords(prev => prev.filter((_, i) => i !== idx));
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary)",
                            fontSize: 14,
                            fontWeight: "bold",
                            cursor: "pointer",
                            padding: "0 2px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = "var(--red-dark)"}
                          onMouseLeave={(e) => e.currentTarget.style.color = "var(--primary)"}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {researchKeywords.length === 0 && (
                      <span style={{ fontSize: 13, color: "var(--text-dim)", alignSelf: "center", paddingLeft: 4 }}>
                        No keywords selected. Add some below.
                      </span>
                    )}
                  </div>

                  {/* Add Keyword Input Box */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Add a new keyword..."
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
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                        background: "var(--card-bg)",
                        color: "var(--text)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        outline: "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--primary)";
                        e.target.style.boxShadow = "0 0 0 3px var(--primary-light)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--border)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = keywordInput.trim();
                        if (val && !researchKeywords.includes(val)) {
                          setResearchKeywords(prev => [...prev, val]);
                          setKeywordInput("");
                        }
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "var(--radius-md)",
                        border: "none",
                        background: "var(--primary)",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-dark)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--primary)"}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Grid for Options */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16,
                  }}
                >
                  {/* Google Maps Country Search Autocomplete */}
                  <div style={{ position: "relative" }} onMouseLeave={() => setShowLocationDropdown(false)}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                      }}
                    >
                      Countries / Locations
                    </label>

                    {/* Google Maps style capsule input */}
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <span style={{ position: "absolute", left: 10, fontSize: 14, color: "var(--text-muted)" }}>
                        🔍
                      </span>
                      <input
                        type="text"
                        placeholder="Search country (e.g. Canada)..."
                        value={locationSearchInput}
                        onChange={(e) => {
                          setLocationSearchInput(e.target.value);
                          setShowLocationDropdown(true);
                        }}
                        onFocus={() => setShowLocationDropdown(true)}
                        style={{
                          width: "100%",
                          padding: "8px 12px 8px 30px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border)",
                          background: "var(--card-bg)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: 13,
                          outline: "none",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                        onFocusCapture={(e) => {
                          e.target.style.borderColor = "var(--primary)";
                          e.target.style.boxShadow = "0 0 0 3px var(--primary-light)";
                        }}
                        onBlurCapture={(e) => {
                          e.target.style.borderColor = "var(--border)";
                          e.target.style.boxShadow = "none";
                        }}
                      />
                      {locationSearchInput && (
                        <button
                          type="button"
                          onClick={() => setLocationSearchInput("")}
                          style={{
                            position: "absolute",
                            right: 10,
                            background: "none",
                            border: "none",
                            fontSize: 12,
                            color: "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Dropdown list */}
                    {showLocationDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          background: "var(--card-bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "var(--shadow-lg)",
                          maxHeight: 200,
                          overflowY: "auto",
                          marginTop: 4,
                        }}
                      >
                        {LOCATION_SUGGESTIONS.filter(item =>
                          item.name.toLowerCase().includes(locationSearchInput.toLowerCase()) ||
                          item.shortcut.toLowerCase().includes(locationSearchInput.toLowerCase())
                        ).map((item, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              if (!researchCountries.includes(item.shortcut)) {
                                setResearchCountries(prev => [...prev, item.shortcut]);
                              }
                              setLocationSearchInput("");
                              setShowLocationDropdown(false);
                            }}
                            style={{
                              padding: "8px 12px",
                              cursor: "pointer",
                              fontSize: 13,
                              borderBottom: "1px solid var(--border-light)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-light)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <div>
                              <span style={{ marginRight: 6 }}>📍</span>
                              <span style={{ fontWeight: 500 }}>{item.name}</span>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 20 }}>
                                {item.details}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", padding: "2px 6px", borderRadius: 4 }}>
                              {item.shortcut}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Countries Location Pin Badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {researchCountries.map(code => {
                        const matched = LOCATION_SUGGESTIONS.find(c => c.shortcut === code);
                        const label = matched ? matched.name : code;
                        return (
                          <span
                            key={code}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 8px",
                              background: "var(--secondary-light)",
                              border: "1px solid var(--secondary-dark)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--secondary-dark)",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            📍 {label} ({code})
                            <button
                              type="button"
                              onClick={() => {
                                setResearchCountries(prev => prev.filter(c => c !== code));
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--secondary-dark)",
                                fontSize: 12,
                                fontWeight: "bold",
                                cursor: "pointer",
                                marginLeft: 2,
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = "var(--red-dark)"}
                              onMouseLeave={(e) => e.currentTarget.style.color = "var(--secondary-dark)"}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                      {researchCountries.length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic", marginTop: 4 }}>
                          No countries selected. Webhook payload will omit location targeting.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Max Ads Input */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 6,
                      }}
                    >
                      Max Ads
                    </label>
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
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                        background: "var(--card-bg)",
                        color: "var(--text)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        outline: "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--primary)";
                        e.target.style.boxShadow = "0 0 0 3px var(--primary-light)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--border)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  {/* Only Active Ads Toggle */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                      }}
                    >
                      Only Active Ads
                    </label>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        userSelect: "none",
                        padding: "6px 0",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={researchOnlyActive}
                        onChange={(e) => setResearchOnlyActive(e.target.checked)}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--primary)",
                          cursor: "pointer",
                        }}
                      />
                      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                        Active Only
                      </span>
                    </label>
                  </div>

                  {/* Sort Option Dropdown */}
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 6,
                      }}
                    >
                      Sort
                    </label>
                    <select
                      value={researchSort}
                      onChange={(e) => setResearchSort(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                        background: "var(--card-bg)",
                        color: "var(--text)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        outline: "none",
                        cursor: "pointer",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "var(--primary)";
                        e.target.style.boxShadow = "0 0 0 3px var(--primary-light)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "var(--border)";
                        e.target.style.boxShadow = "none";
                      }}
                    >
                      <option value="Impressions High → Low">Impressions High → Low</option>
                      <option value="Newest First">Newest First</option>
                    </select>
                  </div>
                </div>
              </div>
              )}

              {/* IDLE / DONE / ERROR STATE: TRIGGER BUTTON */}
              {topicAnalysisExpanded && (analysisStatus === "idle" || analysisStatus === "done" || analysisStatus === "error") && (
                <div style={{ width: "100%" }}>
                  <button
                    onClick={runCompetitorAnalysis}
                    style={{
                      width: "100%",
                      padding: "12px 18px",
                      borderRadius: "var(--radius-md)",
                      border: "none",
                      background: "var(--primary)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "background 0.2s, transform 0.15s",
                      boxShadow: "var(--shadow-md)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary-dark)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {analysisStatus === "done"
                      ? "Re-run competitor analysis"
                      : "Run competitor analysis"}
                  </button>
                  {analysisStatus === "error" && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "var(--red-strong)", background: "var(--red-light)", padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--red)" }}>
                      <strong>Analysis error:</strong> {analysisError || webhookError || "Could not complete competitor analysis."}
                    </div>
                  )}
                </div>
              )}

              {/* ANALYSIS PROGRESS BAR */}
              {analysisStatus === "generating" && (
                <div className="animate-fade-in" style={{
                  background: "#fff", borderRadius: 14, border: "1.5px solid #bfdbfe",
                  padding: "20px 24px", boxShadow: "0 2px 12px rgba(37,99,235,0.08)"
                }}>
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Spinner size={16} color="#2563eb" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Competitor Analysis Running</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{analysisStatusMessage}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#2563eb" }}>{analysisProgress}%</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 8, background: "#e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${analysisProgress}%`,
                      background: "linear-gradient(90deg, #2563eb, #0ea5e9)",
                      borderRadius: 8,
                      transition: "width 1.8s ease-out",
                      boxShadow: "0 0 8px rgba(37,99,235,0.4)"
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
                        background: isDone || isActive ? "#eff6ff" : "#f8fafc",
                        color: isDone || isActive ? "#1d4ed8" : "#94a3b8",
                        border: `1px solid ${isDone || isActive ? "#bfdbfe" : "#e2e8f0"}`,
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
            </Card>

            {/* ── RESULTS ── */}
            {analysisStatus === "done" && analysisData && (
              <div className="animate-slide-up">

                {/* 1. Analysis Summary */}
                {analysisData?.executive_summary && (
                  <AnalysisCollapsiblePanel
                    expanded={analysisCardsExpanded.summary}
                    onToggle={() => toggleAnalysisSection("summary")}
                    title="Analysis Summary"
                    marginBottom={14}
                  >
                    <div style={{ padding: "16px 20px", fontSize: 13, lineHeight: 1.7, color: "var(--text-body)" }}>
                      {analysisData.executive_summary}
                    </div>
                  </AnalysisCollapsiblePanel>
                )}

                {/* 2. Competitor Ads — Card List */}
                {(analysisData?.competitors_table?.length > 0) && (
                  <AnalysisCollapsiblePanel
                    expanded={analysisCardsExpanded.competitors}
                    onToggle={() => toggleAnalysisSection("competitors")}
                    icon={<span style={{ fontSize: 18 }}>🏆</span>}
                    title="Competitor Ads"
                    subtitle={`${analysisData.competitors_table.length} competitors tracked`}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {analysisData.competitors_table.map((row: any, i: number) => {
                        const threat = row?.threat?.toLowerCase();
                        const threatColor = threat === "high" ? { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" } : threat === "medium" ? { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" } : { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" };
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 20px", borderBottom: i < analysisData.competitors_table.length - 1 ? "1px solid #F1F5F9" : "none", transition: "background 0.15s" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            {/* Rank */}
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F1F5F9", color: "#64748B", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                              {i + 1}
                            </div>
                            {/* Name + hook */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{row?.name}</span>
                                <span style={{ fontSize: 11, color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6 }}>{row?.ads} ads</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: threatColor.bg, color: threatColor.color, border: `1px solid ${threatColor.border}` }}>{row?.threat}</span>
                              </div>
                              <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: "#64748B" }}>Angle: </span>{row?.angle}
                              </div>
                              {row?.hook && <div style={{ fontSize: 12, color: "#2563EB", fontStyle: "italic", lineHeight: 1.5 }}>"{row?.hook}"</div>}
                            </div>
                            {/* Score */}
                            <div style={{ flexShrink: 0, textAlign: "center" }}>
                              <div style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${row?.score >= 9 ? "#DC2626" : row?.score >= 7 ? "#D97706" : "#16A34A"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: row?.score >= 9 ? "#DC2626" : row?.score >= 7 ? "#D97706" : "#16A34A" }}>{row?.score}</span>
                              </div>
                              <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>score</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AnalysisCollapsiblePanel>
                )}

                {/* 3. Top Hook Patterns — Cards */}
                {(analysisData?.hooks_table?.length > 0) && (
                  <AnalysisCollapsiblePanel
                    expanded={analysisCardsExpanded.hooks}
                    onToggle={() => toggleAnalysisSection("hooks")}
                    icon={<span style={{ fontSize: 18 }}>🎣</span>}
                    title="Top Hook Patterns"
                    subtitle="Winning formulas from competitor ads"
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {analysisData.hooks_table.map((row: any, i: number) => (
                        <div key={i} style={{ display: "flex", gap: 16, padding: "16px 20px", borderBottom: i < analysisData.hooks_table.length - 1 ? "1px solid #F1F5F9" : "none", transition: "background 0.15s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          {/* Index */}
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Pattern name + score */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{row?.pattern}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE", flexShrink: 0 }}>{row?.score}</span>
                            </div>
                            {/* Example */}
                            {row?.example && <div style={{ fontSize: 12, color: "#2563EB", fontStyle: "italic", lineHeight: 1.5, marginBottom: 6, padding: "6px 10px", background: "#EFF6FF", borderRadius: 8, borderLeft: "3px solid #2563EB" }}>"{row?.example}"</div>}
                            {/* Reason */}
                            {row?.reason && <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>{row?.reason}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AnalysisCollapsiblePanel>
                )}

                {/* 4. Market Insights — full width row */}
                {(analysisData?.market_insights_table?.length > 0) && (
                  <AnalysisCollapsiblePanel
                    expanded={analysisCardsExpanded.market_insights}
                    onToggle={() => toggleAnalysisSection("market_insights")}
                    icon={<span style={{ fontSize: 18 }}>📊</span>}
                    title="Market Insights"
                  >
                    <div style={{ padding: "8px 0" }}>
                      {analysisData.market_insights_table.map((row: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 20px", borderBottom: i < analysisData.market_insights_table.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", width: 90, flexShrink: 0, paddingTop: 2 }}>{row?.field}</div>
                          <div style={{ fontSize: 13, color: "#1E293B", lineHeight: 1.6, flex: 1 }}>{row?.value}</div>
                        </div>
                      ))}
                    </div>
                  </AnalysisCollapsiblePanel>
                )}

                {/* 5. Gap Opportunities — full width row below Market Insights */}
                {(analysisData?.gaps_table?.length > 0) && (
                  <AnalysisCollapsiblePanel
                    expanded={analysisCardsExpanded.gaps}
                    onToggle={() => toggleAnalysisSection("gaps")}
                    icon={<span style={{ fontSize: 18 }}>💡</span>}
                    title="Gap Opportunities"
                    subtitle={`${analysisData.gaps_table.length} opportunities identified`}
                  >
                    <div style={{ padding: "8px 0" }}>
                      {analysisData.gaps_table.map((row: any, i: number) => {
                        const pri = row?.priority?.toLowerCase();
                        const priStyle = pri === "high" ? { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" } : pri === "medium" ? { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" } : { bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" };
                        return (
                          <div key={i} style={{ padding: "12px 20px", borderBottom: i < analysisData.gaps_table.length - 1 ? "1px solid #F1F5F9" : "none", transition: "background 0.15s" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", lineHeight: 1.4 }}>{row?.gap}</div>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: priStyle.bg, color: priStyle.color, border: `1px solid ${priStyle.border}`, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{row?.priority}</span>
                            </div>
                            {row?.opportunity && <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: row?.impact ? 4 : 0 }}>{row?.opportunity}</div>}
                            {row?.impact && <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5 }}>💥 {row?.impact}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </AnalysisCollapsiblePanel>
                )}

                {/* Raw response fallback — shown when none of the expected tables are present */}
                {(!analysisData?.competitors_table?.length &&
                  !analysisData?.hooks_table?.length &&
                  !analysisData?.market_insights_table?.length &&
                  !analysisData?.gaps_table?.length &&
                  !analysisData?.message?.toLowerCase().includes("workflow")) && (
                    <AnalysisCollapsiblePanel
                      expanded={analysisCardsExpanded.raw}
                      onToggle={() => toggleAnalysisSection("raw")}
                      title="Raw Analysis Response"
                      marginBottom={14}
                    >
                      <div style={{ padding: "16px 20px" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                          Analysis completed but no table data was found. Raw output:
                        </div>
                        <pre style={{
                          fontSize: 11,
                          background: "var(--surface)",
                          borderRadius: "var(--radius-md)",
                          padding: 12,
                          overflow: "auto",
                          maxHeight: 300,
                          margin: 0,
                          color: "var(--text)",
                          lineHeight: 1.6,
                        }}>
                          {JSON.stringify(analysisData, null, 2)}
                        </pre>
                      </div>
                    </AnalysisCollapsiblePanel>
                  )}

                {analysisData && (
                  <div>
                    <button
                      onClick={openCreateAdFromAnalysis}
                      disabled={adStatus === "generating" || adStatus === "waiting"}
                      style={{
                        padding: "11px 18px",
                        borderRadius: "var(--radius-md)",
                        border: "none",
                        background: (adStatus === "generating" || adStatus === "waiting") ? "var(--primary-light)" : "var(--primary)",
                        color: (adStatus === "generating" || adStatus === "waiting") ? "var(--primary)" : "#fff",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: (adStatus === "generating" || adStatus === "waiting") ? "not-allowed" : "pointer",
                        opacity: (adStatus === "generating" || adStatus === "waiting") ? 0.7 : 1,
                        fontFamily: "inherit",
                        display: "center",
                        alignItems: "center",
                        gap: 8,
                        transition: "background 0.2s",
                      }}
                    >
                      {adStatus === "generating" ? <><Spinner size={12} color="var(--primary)" /> Sending to pipeline...</> :
                        adStatus === "waiting" ? <><Spinner size={12} color="var(--primary)" /> Generating ad...</> :
                          "Create ad based on this analysis →"}
                    </button>
                    {adStatus === "waiting" && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--amber)" }}>
                        The ad pipeline is generating your ad using the analysis data. Results will appear in the Create Ad tab when ready.
                      </div>
                    )}
                    {adStatus === "error" && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--red-strong)" }}>
                        Could not reach the ad pipeline: {webhookError}. Please try again.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {adsLabView === "pastRuns" && (
          <div
            id="past-runs-section"
            style={{
              background: "#fff", border: "1px solid #E2E8F0",
              borderRadius: 20, overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ padding: "14px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>🕐</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Past Runs</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{sbRows.length} saved {sbRows.length === 1 ? "result" : "results"}</div>
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
                    borderBottom: "1px solid #F1F5F9",
                    transition: "background 0.15s",
                    cursor: "default"
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: "#EFF6FF", color: "#2563EB", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        {sbRows.length - idx}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", lineHeight: 1.35, textTransform: "capitalize", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                        {displayTitle}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 10, display: "flex", alignItems: "center", gap: 5, paddingLeft: 32 }}>
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
                          background: "#2563EB", color: "#fff",
                          fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#1D4ED8";
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
                          e.currentTarget.style.background = "#2563EB";
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>No runs yet</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Your analysis history will appear here</div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE AD
      ═══════════════════════════════════════════════════════ */}
      {tab === "create" && (
        <div className="animate-fade-in" style={{ maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box" }}>
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
            <Card style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "14px 20px", borderBottom: "1.5px solid var(--border-mid)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "linear-gradient(135deg, #eff6ff, #f0f9ff)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📊</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>Competitor Analysis Summary</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Based on your latest analysis run</div>
                  </div>
                </div>
                {(analysisData?.topic || pendingAnalysisTopic) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--primary)", color: "#fff", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                    <span>🏷️</span>
                    <span>{analysisData?.topic || pendingAnalysisTopic}</span>
                  </div>
                )}
              </div>
              {/* Summary text */}
              <div style={{ padding: "16px 20px" }}>
                <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, margin: 0 }}>
                  {analysisData.executive_summary}
                </p>
              </div>
            </Card>
          ) : (
            <Card style={{ marginBottom: 14, padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--amber-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>💡</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>No analysis loaded</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Run or load a competitor analysis from the Ads Lab tab to power your ad creation.</div>
                </div>
              </div>
            </Card>
          )}

          <Card style={{ marginBottom: 14, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
              {/* Toggle configuration panel */}
              {!createTabConfigOpen ? (
                <button
                  onClick={() => setCreateTabConfigOpen(true)}
                  disabled={adStatus === "generating" || adStatus === "waiting" || !analysisData}
                  style={{
                    width: "100%",
                    padding: "11px 18px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: (adStatus === "generating" || adStatus === "waiting" || !analysisData) ? "var(--surface)" : "var(--primary)",
                    color: (adStatus === "generating" || adStatus === "waiting" || !analysisData) ? "var(--primary)" : "#fff",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: (adStatus === "generating" || adStatus === "waiting" || !analysisData) ? "not-allowed" : "pointer",
                    opacity: (adStatus === "generating" || adStatus === "waiting" || !analysisData) ? 0.7 : 1,
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "background 0.2s",
                  }}
                >
                  {adStatus === "generating" ? <><Spinner size={12} color="var(--primary)" /> Sending to pipeline...</> :
                    adStatus === "waiting" ? <><Spinner size={12} color="var(--primary)" /> Generating ad...</> :
                      "Generate ad"}
                </button>
              ) : (
                <div className="animate-fade-in" style={{
                  borderRadius: "var(--radius-lg)",
                  background: "#fff",
                  border: "1.5px solid #e0e7ff",
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
                          border: isError ? "2px solid #ef4444" : isVideo ? "1.5px solid #bfdbfe" : "1.5px solid #e2e8f0",
                          overflow: "hidden",
                          boxShadow: isError ? "0 4px 20px rgba(239,68,68,0.12)" : "0 2px 12px rgba(0,0,0,0.06)",
                          width: "100%", maxWidth: 520, boxSizing: "border-box",
                        }}>
                          {/* Config card header */}
                          <div style={{
                            padding: "12px 18px",
                            background: isError ? "linear-gradient(135deg, #fef2f2, #fee2e2)"
                              : isNotStarted ? "linear-gradient(135deg, #fffbeb, #fef3c7)"
                              : isVideo ? "linear-gradient(135deg, #eff6ff, #dbeafe)" : "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                            borderBottom: isError ? "1.5px solid #fecaca" : isNotStarted ? "1.5px solid #fde68a" : isVideo ? "1.5px solid #bfdbfe" : "1.5px solid #e2e8f0"
                          }}>
                            {/* Left: icon + label */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: isError ? "#fee2e2" : isNotStarted ? "#fef3c7" : isVideo ? "#dbeafe" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                                {isError ? "⚠️" : isNotStarted ? "⏸" : isVideo ? "🎬" : "🖼️"}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: isError ? "#dc2626" : isNotStarted ? "#92400e" : isVideo ? "#1d4ed8" : "#475569" }}>
                                  {isVideo ? "Video" : "Image"} Ad
                                </div>
                                <div style={{ fontSize: 10, color: isError ? "#ef4444" : isNotStarted ? "#d97706" : isVideo ? "#3b82f6" : "#94a3b8", marginTop: 1, fontWeight: 600 }}>
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
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                  >↺ Reset</button>
                                  {/* Video / Image toggle */}
                                  <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1.5px solid #e2e8f0", opacity: toggleLocked ? 0.45 : 1 }}
                                    title={toggleLocked ? "Locked while generating" : undefined}>
                                    <button type="button"
                                      onClick={() => !toggleLocked && setCreateTabItemType(idx, "video")}
                                      style={{ padding: "6px 14px", border: "none", fontSize: 12, fontWeight: 700, cursor: toggleLocked ? "not-allowed" : "pointer", background: isVideo ? "#2563eb" : "#f1f5f9", color: isVideo ? "#fff" : "#64748b", transition: "all 0.15s" }}
                                    >🎬 Video</button>
                                    <div style={{ width: 1, background: "#e2e8f0" }} />
                                    <button type="button"
                                      onClick={() => !toggleLocked && setCreateTabItemType(idx, "image")}
                                      style={{ padding: "6px 14px", border: "none", fontSize: 12, fontWeight: 700, cursor: toggleLocked ? "not-allowed" : "pointer", background: !isVideo ? "#2563eb" : "#f1f5f9", color: !isVideo ? "#fff" : "#64748b", transition: "all 0.15s" }}
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
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Duration</div>
                                  <CustomSelect
                                    value={item.duration}
                                    onChange={(v) => updateCreateTabItemField(idx, "duration", v)}
                                    options={DURATIONS.map(d => ({ value: d, label: d }))}
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Audio Style</div>
                                  <CustomSelect
                                    value={item.audioStyle}
                                    onChange={(v) => updateCreateTabItemField(idx, "audioStyle", v)}
                                    options={AUDIO_STYLES.map(a => ({ value: a, label: a }))}
                                  />
                                </div>
                              </div>
                              <div className="config-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minWidth: 0 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Character</div>
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
                                {item.audioStyle !== "Background Music" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Voice</div>
                                  <button
                                    type="button"
                                    onClick={() => setVoiceModalOpenForId(item.id)}
                                    style={{
                                      width: "100%", padding: "10px", borderRadius: "var(--radius-md)",
                                      border: voiceLabels[item.id] ? "none" : "2px dashed #93c5fd",
                                      background: voiceLabels[item.id] ? "#0284c7" : "#eff6ff", color: voiceLabels[item.id] ? "#fff" : "#0284c7",
                                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                      fontFamily: "inherit", transition: "all 0.15s",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = voiceLabels[item.id] ? "#0369a1" : "#dbeafe"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = voiceLabels[item.id] ? "#0284c7" : "#eff6ff"; }}
                                  >
                                    🎙️ {voiceLabels[item.id] ? "Voice Selected" : "Select Voice *"}
                                  </button>
                                  {voiceLabels[item.id] && (
                                    <div style={{
                                      display: "flex", alignItems: "center", gap: 4, minWidth: 0,
                                      padding: "4px 8px", background: "#eff6ff",
                                      border: "1px solid #bfdbfe", borderRadius: 6,
                                      overflow: "hidden",
                                    }}>
                                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, fontWeight: 600, color: "#1d4ed8" }}>
                                        {voiceLabels[item.id]}
                                      </span>
                                      <span style={{ fontSize: 9, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", background: "#dbeafe", padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>
                                        ✓
                                      </span>
                                    </div>
                                  )}
                                </div>
                                )}
                              </div>
                              <div className="config-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visual Style</div>
                                  <CustomSelect
                                    value={item.videoStyle}
                                    onChange={(v) => updateCreateTabItemField(idx, "videoStyle", v)}
                                    options={VIDEO_STYLES.map(s => ({ value: s, label: s }))}
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Language</div>
                                  <CustomSelect
                                    value={item.language || "English"}
                                    onChange={(v) => updateCreateTabItemField(idx, "language", v)}
                                    options={LANGUAGES.map(l => ({ value: l, label: l }))}
                                  />
                                </div>
                              </div>
                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    Script / Storyboard Idea <span style={{ color: "#ef4444" }}>*</span>
                                  </div>
                                  {/* Hide Generate An Idea button once prompts are being generated */}
                                  {adStatus !== "generating" && !adScenesGenerating[item.id] && <button
                                    disabled={sentIdeaIds[item.id] || !item.idea?.trim()}
                                    onClick={async () => {
                                      if (sentIdeaIds[item.id]) return;
                                      // Require idea/storyboard text
                                      if (!item.idea?.trim()) {
                                        addSbToast("Please enter a Script / Storyboard Idea first.", "error");
                                        return;
                                      }
                                      // Require voice selection for video items (not needed for Background Music)
                                      if (isVideo && item.audioStyle !== "Background Music" && !voiceLabels[item.id]) {
                                        addSbToast("Please select a voice first — click the 🎙️ Voices button.", "error");
                                        return;
                                      }
                                      setSentIdeaIds(prev => ({ ...prev, [item.id]: true }));
                                      addSbToast(`Generating Video ${idx + 1} ideas...`);
                                      try {
                                        const res = await fetch(CREATE_AD_IDEAS_API, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ ...item, brand_config: getBrandConfigForAnalysis() }),
                                          cache: "no-store"
                                        });
                                        if (res.ok) {
                                          const data = await res.json();
                                          let ideasArr = [];
                                          if (Array.isArray(data)) {
                                            if (data[0] && Array.isArray(data[0].ideas)) ideasArr = data[0].ideas;
                                            else if (data[0] && data[0].idea) ideasArr = data;
                                            else if (Array.isArray(data[0])) ideasArr = data[0];
                                          } else if (data && Array.isArray(data.ideas)) {
                                            ideasArr = data.ideas;
                                          }
                                          if (ideasArr && ideasArr.length > 0) {
                                            setGeneratedIdeas(prev => ({ ...prev, [item.id]: ideasArr }));
                                            addSbToast("Ideas generated successfully!", "success");
                                          } else {
                                            console.error("Unrecognized JSON format from ad pipeline:", data);
                                            addSbToast("No valid ideas format returned.", "error");
                                          }
                                        } else {
                                          addSbToast("Failed to generate ideas", "error");
                                        }
                                      } catch (err) {
                                        addSbToast("Error fetching ideas", "error");
                                      } finally {
                                        setSentIdeaIds(prev => ({ ...prev, [item.id]: false }));
                                      }
                                    }}
                                    style={{
                                      padding: "5px 12px", borderRadius: "var(--radius-sm)", border: "none",
                                      background: (sentIdeaIds[item.id] || !item.idea?.trim()) ? "#94a3b8" : "linear-gradient(135deg, #0284c7, #38bdf8)",
                                      color: "#fff", fontSize: 10, fontWeight: 700,
                                      cursor: (sentIdeaIds[item.id] || !item.idea?.trim()) ? "not-allowed" : "pointer",
                                      transition: "all 0.2s", textTransform: "uppercase",
                                      opacity: (sentIdeaIds[item.id] || !item.idea?.trim()) ? 0.6 : 1,
                                      boxShadow: (sentIdeaIds[item.id] || !item.idea?.trim()) ? "none" : "0 3px 10px rgba(2,132,199,0.4)"
                                    }}
                                  >
                                    {sentIdeaIds[item.id] ? "✨ Generating..." : "✨ Generate an idea"}
                                  </button>}
                                </div>
                                <textarea
                                  placeholder="Required — describe your video concept, offer, or story angle..."
                                  value={item.idea}
                                  disabled={!!sentIdeaIds[item.id]}
                                  onChange={(e) => updateCreateTabItemField(idx, "idea", e.target.value)}
                                  style={{
                                    width: "100%", minHeight: 80, padding: "12px", borderRadius: "var(--radius-md)",
                                    border: `1.5px solid ${item.idea?.trim() ? "#bae6fd" : "#fca5a5"}`,
                                    background: sentIdeaIds[item.id] ? "#f8fafc" : item.idea?.trim() ? "#fff" : "#fff7f7",
                                    fontSize: 12, outline: "none", color: "#0369a1", resize: "vertical", fontFamily: "inherit",
                                    cursor: sentIdeaIds[item.id] ? "not-allowed" : "auto"
                                  }}
                                />
                                {generatedIdeas[item.id] && generatedIdeas[item.id].length > 0 && (
                                  <div style={{
                                    marginTop: 16, display: "flex", flexDirection: "column", gap: 10,
                                    padding: "16px", borderRadius: 12,
                                    border: "1.5px solid #bae6fd",
                                    background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)"
                                  }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.04em" }}>✨ AI Generated Ideas — Click to use</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                                      {generatedIdeas[item.id].map((ideaObj, ideaIndex) => (
                                        <div
                                          key={`${item.id}-${ideaIndex}`}
                                          onClick={() => {
                                            updateCreateTabItemField(idx, "idea", ideaObj.idea);
                                            setGeneratedIdeas(prev => {
                                              const updated = { ...prev };
                                              delete updated[item.id];
                                              return updated;
                                            });
                                          }}
                                          style={{
                                            padding: "13px 16px", borderRadius: 10, border: "1.5px solid #bae6fd",
                                            background: "#fff", cursor: "pointer", fontSize: 12, color: "#0369a1",
                                            transition: "all 0.18s", lineHeight: 1.6, boxShadow: "0 2px 8px rgba(2,132,199,0.07)"
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0284c7"; e.currentTarget.style.background = "#f0f9ff"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(2,132,199,0.15)"; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#bae6fd"; e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(2,132,199,0.07)"; }}
                                        >
                                          {ideaObj.idea}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visual Style</div>
                                <CustomSelect
                                  value={item.imageStyle || "Bold & Colorful"}
                                  onChange={(v) => updateCreateTabItemField(idx, "imageStyle", v)}
                                  options={VIDEO_STYLES.map(s => ({ value: s, label: s }))}
                                />
                              </div>
                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Image Description / Prompt</div>
                                  {adStatus !== "generating" && !adScenesGenerating[item.id] && item.idea?.trim() && <button
                                    disabled={sentIdeaIds[item.id]}
                                    onClick={async () => {
                                      if (sentIdeaIds[item.id]) return;
                                      setSentIdeaIds(prev => ({ ...prev, [item.id]: true }));
                                      addSbToast(`Generating Image ${idx + 1} ideas...`);
                                      try {
                                        const res = await fetch(CREATE_AD_IDEAS_API, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ ...item, brand_config: getBrandConfigForAnalysis() }),
                                          cache: "no-store"
                                        });
                                        if (res.ok) {
                                          const data = await res.json();
                                          let ideasArr = [];
                                          if (Array.isArray(data)) {
                                            if (data[0] && Array.isArray(data[0].ideas)) ideasArr = data[0].ideas;
                                            else if (data[0] && data[0].idea) ideasArr = data;
                                            else if (Array.isArray(data[0])) ideasArr = data[0];
                                          } else if (data && Array.isArray(data.ideas)) {
                                            ideasArr = data.ideas;
                                          }
                                          if (ideasArr && ideasArr.length > 0) {
                                            setGeneratedIdeas(prev => ({ ...prev, [item.id]: ideasArr }));
                                            addSbToast("Ideas generated successfully!", "success");
                                          } else {
                                            console.error("Unrecognized JSON format from ad pipeline:", data);
                                            addSbToast("No valid ideas format returned.", "error");
                                          }
                                        } else {
                                          addSbToast("Failed to generate ideas", "error");
                                        }
                                      } catch (err) {
                                        addSbToast("Error fetching ideas", "error");
                                      } finally {
                                        setSentIdeaIds(prev => ({ ...prev, [item.id]: false }));
                                      }
                                    }}
                                    style={{
                                      padding: "5px 12px", borderRadius: "var(--radius-sm)", border: "none",
                                      background: sentIdeaIds[item.id] ? "#fde68a" : "linear-gradient(135deg, #b45309, #d97706)",
                                      color: "#fff", fontSize: 10, fontWeight: 700,
                                      cursor: sentIdeaIds[item.id] ? "not-allowed" : "pointer",
                                      transition: "all 0.2s", textTransform: "uppercase",
                                      opacity: sentIdeaIds[item.id] ? 0.7 : 1,
                                      boxShadow: sentIdeaIds[item.id] ? "none" : "0 3px 10px rgba(217,119,6,0.4)"
                                    }}
                                  >
                                    {sentIdeaIds[item.id] ? "✨ Generating..." : "✨ Generate an idea"}
                                  </button>}
                                </div>
                                <textarea
                                  placeholder="Describe the aesthetic, colors, and subject of the image..."
                                  value={item.idea}
                                  disabled={!!sentIdeaIds[item.id]}
                                  onChange={(e) => updateCreateTabItemField(idx, "idea", e.target.value)}
                                  style={{
                                    width: "100%", minHeight: 80, padding: "12px", borderRadius: "var(--radius-md)",
                                    border: "1.5px solid #fde68a", background: sentIdeaIds[item.id] ? "#f8fafc" : "#fff",
                                    fontSize: 12, outline: "none", color: "#78350f", resize: "vertical", fontFamily: "inherit",
                                    cursor: sentIdeaIds[item.id] ? "not-allowed" : "auto"
                                  }}
                                />
                                {generatedIdeas[item.id] && generatedIdeas[item.id].length > 0 && (
                                  <div style={{
                                    marginTop: 16, display: "flex", flexDirection: "column", gap: 10,
                                    padding: "16px", borderRadius: 12,
                                    border: "1.5px solid #fde68a",
                                    background: "linear-gradient(135deg, #fffbeb, #fef3c7)"
                                  }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}>✨ AI Generated Ideas — Click to use</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                                      {generatedIdeas[item.id].map((ideaObj, ideaIndex) => (
                                        <div
                                          key={`${item.id}-img-${ideaIndex}`}
                                          onClick={() => {
                                            updateCreateTabItemField(idx, "idea", ideaObj.idea);
                                            setGeneratedIdeas(prev => {
                                              const updated = { ...prev };
                                              delete updated[item.id];
                                              return updated;
                                            });
                                          }}
                                          style={{
                                            padding: "13px 16px", borderRadius: 10, border: "1.5px solid #fde68a",
                                            background: "#fff", cursor: "pointer", fontSize: 12, color: "#78350f",
                                            transition: "all 0.18s", lineHeight: 1.6, boxShadow: "0 2px 8px rgba(217,119,6,0.07)"
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#d97706"; e.currentTarget.style.background = "#fffbeb"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(217,119,6,0.15)"; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#fde68a"; e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(217,119,6,0.07)"; }}
                                        >
                                          {ideaObj.idea}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* ── View Image & Video Prompts button ── */}
                          {adScenesGenerating[item.id] ? (
                            <div style={{
                              marginTop: 16, padding: "13px 0", display: "flex", alignItems: "center",
                              justifyContent: "center", gap: 8, borderTop: "1.5px solid #e2e8f0",
                              color: isVideo ? "#0284c7" : "#b45309", fontSize: 12, fontWeight: 600,
                            }}>
                              <Spinner size={14} color={isVideo ? "#0284c7" : "#b45309"} />
                              {isVideo ? "Generating prompts… please wait" : "Generating image… please wait"}
                            </div>
                          ) : generationActive && !doesSlotHaveError(item.id) && adScenesMap[item.id]?.length > 0 ? (
                            <div style={{
                              marginTop: 16, padding: "13px 0", display: "flex", alignItems: "center",
                              justifyContent: "center", gap: 8, borderTop: "1.5px solid #bae6fd",
                              background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", borderRadius: "0 0 12px 12px",
                              color: "#0284c7", fontSize: 12, fontWeight: 700,
                            }}>
                              <Spinner size={13} color="#0284c7" />
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
                                  ? "linear-gradient(135deg, #dc2626, #ef4444)"
                                  : isVideo ? "linear-gradient(135deg, #0284c7, #38bdf8)" : "linear-gradient(135deg, #b45309, #d97706)",
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
                                  background: "linear-gradient(135deg, #0284c7, #0ea5e9)", color: "#fff",
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
                    ) : (() => {
                      const allIdeasFilled = (createTabAdsConfig.items || []).every((item: any) => item.idea?.trim());
                      const ideaGenerating = Object.values(sentIdeaIds).some(Boolean);
                      return (!allIdeasFilled || ideaGenerating) ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#92400e", fontSize: 13 }}>
                          <span style={{ fontSize: 16 }}>{ideaGenerating ? "⏳" : "✏️"}</span>
                          <span>{ideaGenerating ? <><Spinner size={12} color="#92400e" /> <b>Generating idea…</b> please wait before confirming.</> : <>Fill in the <b>Script / Storyboard Idea</b> for each ad to unlock generation.</>}</span>
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
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#0284c7" }}>
                              <span><Spinner size={11} color="#0284c7" /> {createTabAdsConfig.items[0]?.type === "video" ? "Generating prompts…" : "Generating image…"}</span>
                              <span>{promptGenProgress}%</span>
                            </div>
                            <div style={{ height: 5, background: "#dbeafe", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", background: "linear-gradient(90deg, #2563eb, #0ea5e9)", borderRadius: 3, width: `${promptGenProgress}%`, transition: "width 1.8s ease-out" }} />
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
                                {/* Generation active */}
                                {generationActive && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#0284c7" }}>
                                    <Spinner size={14} color="#0284c7" /> Generation in progress…
                                  </div>
                                )}

                                {/* START AGAIN — when errors or not-started exist after generation ran */}
                                {!generationActive && generationEverRan && hasRemaining && (
                                  <button
                                    onClick={handleStartAgain}
                                    type="button"
                                    style={{
                                      padding: "12px 28px", borderRadius: "var(--radius-lg)", border: "none",
                                      background: "linear-gradient(135deg, #0284c7, #0ea5e9)", color: "#fff",
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
                                background: locked ? "var(--primary-light)" : isImageAd ? "linear-gradient(135deg, #d97706, #f59e0b)" : "linear-gradient(135deg, #0284c7, #0ea5e9)",
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
          </Card>




          {/* Errors are now shown inline on each card — no separate bottom panel needed */}

          {/* ── FAILED IMAGE PROMPTS PANEL ── */}
          {failedImagePrompts.length > 0 && (
            <div style={{ marginTop: 20, borderRadius: 16, overflow: "hidden", border: "2px solid #ef4444", boxShadow: "0 8px 32px rgba(220,38,38,0.18)" }}>
              {/* Header */}
              <div style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                        <span style={{ background: "#ef4444", color: "#fff", borderRadius: 8, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>
                          Image #{fp.index + 1}
                        </span>
                        <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 600 }}>Policy Violation</span>
                      </div>
                      <button
                        onClick={() => setEditingImagePrompt({ open: true, index: fp.index, prompt: fp.prompt, reason: fp.reason })}
                        style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "7px 16px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
                      >
                        ✏️ Edit &amp; Resubmit
                      </button>
                    </div>
                    <div style={{ background: "#fff1f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Prompt</div>
                      <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.6, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{fp.prompt}</div>
                    </div>
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🚫</span>
                      <div style={{ fontSize: 12, color: "#991b1b", lineHeight: 1.5 }}><b>Reason: </b>{fp.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Video Generation Progress Bar (tab-level, always visible) ── */}
          {videoGenerating && (
            <div style={{ marginBottom: 16, padding: "16px 18px", borderRadius: 14, background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1.5px solid #86efac", boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Spinner size={14} color="#16a34a" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>
                    {videoGenProgress >= 100 ? "🎬 Videos ready!" : "Generating your videos…"}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a" }}>{videoGenProgress}%</span>
              </div>
              <div style={{ height: 8, background: "#bbf7d0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${videoGenProgress}%`, background: videoGenProgress >= 100 ? "#16a34a" : "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 8, transition: "width 1.8s ease-out", boxShadow: "0 0 8px rgba(22,163,74,0.4)" }} />
              </div>
              <div style={{ fontSize: 11, color: "#16a34a", marginTop: 6 }}>
                {videoGenProgress >= 100 ? "Check the Ad Previews section below ↓" : "You can freely navigate — we'll notify you when done."}
              </div>
            </div>
          )}

          {/* ── AD PREVIEWS ── */}
          <div style={{ marginTop: 24 }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5" style={{ marginBottom: 12 }}>
              <SectionTitle style={{ marginBottom: 0 }}>Ad Previews — Dynamic Table</SectionTitle>
              <button
                onClick={handleRefreshAdVideos}
                disabled={adVideosLoading}
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                  padding: "10px 24px", borderRadius: "var(--radius-md)",
                  border: "0.5px solid var(--border)", background: "var(--surface)",
                  color: "var(--text)", fontSize: 13, fontWeight: 600,
                  cursor: adVideosLoading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: adVideosLoading ? 0.6 : 1,
                  transition: "all 0.2s",
                  boxShadow: "var(--shadow-sm)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface)"}
              >
                <span style={{
                  display: "inline-block",
                  fontSize: 16,
                  animation: adVideosLoading ? "spin 1s linear infinite" : "none"
                }}>↻</span>
                {adVideosLoading ? "Refreshing..." : "Refresh Previews"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {pendingAds.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" }}>
                  No pending ads to preview.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 px-0 sm:px-4" style={{ maxWidth: "1100px", margin: "0 auto" }}>
                  {pendingAds.map((latestEntry) => {
                    const url = latestEntry?.text || "";
                    const isVideo = (latestEntry?.format || "").toLowerCase() === "video";
                    const adKey = latestEntry?.id + "_" + latestEntry?.time;
                    const mediaMissing = missingMediaKeys.has(adKey);
                    const id = latestEntry?.id || "Unknown";
                    const label = isVideo ? `Video Ad ${id}` : `Image Ad ${id}`;
                    const markMediaMissing = () => {
                      setMissingMediaKeys((prev) => new Set(prev).add(adKey));
                    };

                    return (
                      <Card key={adKey} style={{ padding: 12, height: "100%" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {label}
                        </div>
                        <div style={{
                          background: "#000",
                          borderRadius: "var(--radius-md)",
                          aspectRatio: "9/16",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          boxShadow: "inset 0 0 40px rgba(0,0,0,0.5)"
                        }}>
                          {isAdApproved(latestEntry?.Approved) ? (
                            <div style={{ fontSize: 13, color: "#fff", fontWeight: 700, textAlign: "center", padding: 20 }}>
                              ✓ Approved
                            </div>
                          ) : mediaMissing ? (
                            <div style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600, textAlign: "center", padding: 20, lineHeight: 1.5 }}>
                              Media no longer in Supabase storage
                            </div>
                          ) : !url ? (
                            <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", padding: 10 }}>
                              Waiting for {label} link...
                            </div>
                          ) : isVideo ? (
                            <video
                              key={url}
                              src={url}
                              controls
                              autoPlay={false}
                              onError={markMediaMissing}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : (
                            <img
                              key={url}
                              src={url}
                              alt={label}
                              onError={markMediaMissing}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          )}
                        </div>

                        {mediaMissing && (
                          <div style={{ marginTop: 12 }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteStaleAd(latestEntry)}
                              disabled={removingId === adKey}
                              style={{
                                width: "100%", padding: "8px 0", borderRadius: "var(--radius-md)",
                                border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c",
                                fontSize: 11, fontWeight: 700, cursor: removingId === adKey ? "not-allowed" : "pointer",
                                opacity: removingId === adKey ? 0.7 : 1, fontFamily: "inherit",
                              }}
                            >
                              {removingId === adKey ? "Removing..." : "Remove stale entry"}
                            </button>
                          </div>
                        )}

                        {url && !isAdApproved(latestEntry?.Approved) && !mediaMissing && (
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button
                              onClick={() => setSelectedAdForDetails(latestEntry)}
                              style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 6, padding: "8px 0", borderRadius: "var(--radius-md)",
                                border: "1px solid var(--border)", background: "var(--surface)",
                                color: "var(--text)", fontSize: 11, fontWeight: 600,
                                cursor: "pointer", fontFamily: "inherit"
                              }}
                            >
                              ↗ Full View
                            </button>
                            <button
                              onClick={() => handleApproveAd(latestEntry)}
                              disabled={approvingId === adKey}
                              style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 6, padding: "8px 0", borderRadius: "var(--radius-md)",
                                border: "none", background: "var(--primary)", color: "#fff",
                                fontSize: 11, fontWeight: 600,
                                cursor: approvingId === adKey ? "not-allowed" : "pointer",
                                opacity: approvingId === adKey ? 0.7 : 1,
                              }}
                            >
                              {approvingId === adKey ? <Spinner size={10} /> : "✓ Approve"}
                            </button>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* ── CUSTOM MEDIA UPLOAD ── */}
              <div style={{
                marginTop: 32, padding: 24, borderRadius: "var(--radius-lg)",
                background: "var(--surface)", border: "2px dashed #000",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
              }}>
                <SectionTitle style={{ marginBottom: 4, fontSize: 16 }}>Or Upload Your Own Media</SectionTitle>
              <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", maxWidth: 400 }}>
                Skip the AI generation and upload your own video or image. It will go directly to the Approved section.
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
                        setTab("approval");
                        addSbToast("Media uploaded and approved! Check the Approval tab.", "success");
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
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          APPROVAL
      ═══════════════════════════════════════════════════════ */}
      {tab === "approval" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ paddingBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <SectionTitle style={{ marginBottom: 0 }}>Ad Approval Queue</SectionTitle>
                {/* Filter pills — left side, next to title */}
                <div style={{ display: "flex", background: "#e2e8f0", borderRadius: 8, padding: 2, gap: 1 }}>
                  {[
                    { value: "all", label: "All" },
                    { value: "video", label: "🎬 Video" },
                    { value: "image", label: "🖼️ Image" },
                  ].map(f => (
                    <button
                      key={f.value}
                      onClick={() => setApprovalFilter(f.value)}
                      style={{
                        padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                        fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                        background: approvalFilter === f.value ? "#1e293b" : "transparent",
                        color: approvalFilter === f.value ? "#fff" : "#475569",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Review and launch your final approved creatives from the database.
              </div>
            </div>
            <div style={{ background: "var(--green-light)", padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--green)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase" }}>Approved</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--green)" }}>{allApprovedAds.length}</div>
              </div>
            </div>
          </div>

          {allApprovedAds.length === 0 && adVideosLoading ? (
            /* Skeleton loading cards */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[1,2,3,4].map(n => (
                <div key={n} style={{ background: "#fff", borderRadius: 14, padding: 12, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <div className="skeleton" style={{ width: 56, height: 20, borderRadius: 20 }} />
                    <div className="skeleton" style={{ flex: 1, height: 12, borderRadius: 6 }} />
                  </div>
                  <div className="skeleton" style={{ width: "100%", aspectRatio: "9/16", borderRadius: 10 }} />
                  <div className="skeleton" style={{ width: "100%", height: 34, borderRadius: 8 }} />
                  <div className="skeleton" style={{ width: "100%", height: 34, borderRadius: 8 }} />
                </div>
              ))}
            </div>
          ) : allApprovedAds.length === 0 ? null : (
            <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: "1200px", margin: "0 auto" }}>
              {(() => {
                const renderApprovalCard = (ad) => {
                  const isVid = (ad.format || "").toLowerCase() === "video";
                  const isMobileCard = typeof window !== "undefined" && window.innerWidth <= 768;
                  const adDate = new Date(ad.time);
                  const dateStr = `${adDate.getDate()}/${adDate.getMonth()+1}`;
                  const timeStr = adDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  return (
                    <Card key={`${ad.id}_${ad.time}`} style={{ padding: isMobileCard ? 8 : 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
                          padding: "2px 7px", borderRadius: 20,
                          color: isVid ? "var(--primary)" : "var(--amber)",
                          background: isVid ? "var(--primary-light)" : "var(--amber-light)",
                          border: `1px solid ${isVid ? "var(--primary-mid)" : "#fde68a"}`,
                          flexShrink: 0
                        }}>
                          {isVid ? "🎬" : "🖼️"} {isVid ? "Video" : "Image"}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--text-dim)", fontWeight: 500, lineHeight: 1.2, textAlign: "right" }}>
                          {dateStr}<br/>{timeStr}
                        </span>
                      </div>

                      {/* Media */}
                      <div style={{
                        background: "#000", borderRadius: 10,
                        aspectRatio: "9/16", overflow: "hidden",
                        boxShadow: "var(--shadow-sm)", flexShrink: 0
                      }}>
                        {isVid ? (
                          <video src={ad.text} controls autoPlay={false} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                          <img src={ad.text} alt="Ad" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                        <button
                          onClick={() => setSelectedAdForDetails(ad)}
                          style={{
                            fontSize: isMobileCard ? 10 : 11, fontWeight: 700, padding: isMobileCard ? "7px 4px" : "9px 10px",
                            borderRadius: 8, border: "1px solid var(--border)", color: "var(--text)",
                            background: "var(--surface)", cursor: "pointer", fontFamily: "inherit",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.15s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"}
                          onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}
                        >↗ Details</button>
                        <button
                          onClick={() => handleRemoveApprovedAd(ad)}
                          disabled={removingId === (ad.id + "_" + ad.time)}
                          style={{
                            fontSize: isMobileCard ? 10 : 11, fontWeight: 700, padding: isMobileCard ? "7px 4px" : "9px 10px",
                            borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c",
                            background: "#fef2f2", cursor: removingId === (ad.id + "_" + ad.time) ? "not-allowed" : "pointer",
                            fontFamily: "inherit", opacity: removingId === (ad.id + "_" + ad.time) ? 0.7 : 1,
                          }}
                        >{removingId === (ad.id + "_" + ad.time) ? "Removing..." : "Remove"}</button>
                        <button
                          onClick={() => { setLaunchAdCandidate(ad); setTab("campaigns"); }}
                          style={{
                            border: "none", borderRadius: 8, padding: isMobileCard ? "7px 4px" : "9px 10px",
                            background: "linear-gradient(135deg, var(--primary), #6366f1)",
                            color: "#fff", fontSize: isMobileCard ? 10 : 12, fontWeight: 700,
                            cursor: "pointer", textAlign: "center", transition: "transform 0.1s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        >{isMobileCard ? "Launch →" : "Launch to Facebook →"}</button>
                      </div>
                    </Card>
                  );
                };

                const sorted = [...allApprovedAds].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
                const videos = sorted.filter(ad => (ad.format || "").toLowerCase() === "video");
                const images = sorted.filter(ad => (ad.format || "").toLowerCase() !== "video");
                const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

                // Mobile: 2 cols; Desktop: 4 cols
                const gridCols = isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
                const gridGap = isMobile ? 10 : 16;

                if (approvalFilter === "video") {
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: gridGap }}>
                      {videos.map(renderApprovalCard)}
                    </div>
                  );
                }
                if (approvalFilter === "image") {
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: gridGap }}>
                      {images.map(renderApprovalCard)}
                    </div>
                  );
                }

                // "All" view
                if (isMobile) {
                  // Mobile: stack videos then images in single column
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      {videos.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🎬 Videos ({videos.length})</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                            {videos.map(renderApprovalCard)}
                          </div>
                        </div>
                      )}
                      {images.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🖼️ Images ({images.length})</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                            {images.map(renderApprovalCard)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Desktop: left 2 cols videos | separator | right 2 cols images
                return (
                  <div style={{ display: "flex", gap: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SectionTitle style={{ marginBottom: 12, fontSize: 14 }}>Approved Videos</SectionTitle>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                        {videos.map(renderApprovalCard)}
                      </div>
                    </div>
                    <div style={{ width: 2, background: "#0f172a", margin: "0 24px", borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SectionTitle style={{ marginBottom: 12, fontSize: 14 }}>Approved Images</SectionTitle>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                        {images.map(renderApprovalCard)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div
        className="animate-fade-in"
        style={{ display: tab === "variants" ? "block" : "none", paddingTop: 8 }}
      >
        <GenerateVariants
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
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
            <div>
              <SectionTitle style={{ marginBottom: 4 }}>Running Campaigns</SectionTitle>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Monitor and control your live Meta Ads.
              </div>
            </div>
            <button
              onClick={fetchLiveCampaigns}
              disabled={liveLoading}
              style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
            >
              {liveLoading ? <Spinner size={12} /> : "↻"} Refresh
            </button>
          </div>

          {liveError && (
            <Card style={{ background: "var(--red-light)", border: "1px solid var(--red-strong)" }}>
              <div style={{ color: "var(--red-strong)", fontSize: 14 }}>{liveError}</div>
            </Card>
          )}

          {!liveLoading && liveCampaigns.length === 0 && !liveError && (
            <Card>
              <EmptyState title="No campaigns found" sub="Start a new campaign in the 'Campaign Setup' tab." />
            </Card>
          )}

          {liveCampaigns.map(campaign => (
            <Card key={campaign.id} style={{ padding: 0, overflow: "hidden" }}>
              {/* Campaign Header */}
              <div
                onClick={() => setExpandedCampaigns(prev => {
                  const next = new Set(prev);
                  if (next.has(campaign.id)) next.delete(campaign.id);
                  else next.add(campaign.id);
                  return next;
                })}
                style={{ padding: "14px 16px", background: "var(--surface)", borderBottom: expandedCampaigns.has(campaign.id) ? "1px solid var(--border-light)" : "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}
              >
                {/* Top row: arrow + name + status */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 16, color: "var(--primary)", transition: "transform 0.2s", transform: expandedCampaigns.has(campaign.id) ? "rotate(90deg)" : "rotate(0deg)", marginTop: 2, flexShrink: 0 }}>▶</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campaign.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>ID: {campaign.id}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{campaign.objective}</div>
                  </div>
                  <Badge
                    text={campaign.effective_status}
                    color={campaign.effective_status === "ACTIVE" ? "var(--green)" : "var(--amber)"}
                    bg={campaign.effective_status === "ACTIVE" ? "var(--green-light)" : "var(--amber-light)"}
                  />
                </div>
                {/* Bottom row: action buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingLeft: 26 }} onClick={(e) => e.stopPropagation()}>
                  {[
                    { label: "Edit", color: "var(--primary)", border: "var(--primary)", fn: () => handleEditCampaign(campaign.id), disabled: false },
                    { label: "Run", color: "var(--green)", border: "var(--green)", fn: () => handleUpdateStatus(campaign.id, "Campaign", "ACTIVE", "run"), disabled: campaign.effective_status === "ACTIVE" || updatingStatusId === campaign.id },
                    { label: "Pause", color: "var(--amber)", border: "var(--amber)", fn: () => handleUpdateStatus(campaign.id, "Campaign", "PAUSED", "pause"), disabled: campaign.effective_status === "PAUSED" || updatingStatusId === campaign.id },
                    { label: "Delete", color: "var(--red-strong)", border: "var(--red-strong)", fn: () => handleUpdateStatus(campaign.id, "Campaign", null, "delete"), disabled: updatingStatusId === campaign.id },
                  ].map(btn => (
                    <button key={btn.label}
                      onClick={(e) => { e.stopPropagation(); btn.fn(); }}
                      disabled={btn.disabled}
                      style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${btn.border}`, background: "transparent", color: btn.color, fontSize: 11, fontWeight: 700, cursor: btn.disabled ? "default" : "pointer", opacity: btn.disabled ? 0.45 : 1, transition: "all 0.15s" }}
                    >{btn.label}</button>
                  ))}
                </div>
              </div>

              {/* Campaign Body (Ad Sets) */}
              {expandedCampaigns.has(campaign.id) && (
                <div style={{ padding: "10px 20px 20px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {campaign.adsets?.data?.length > 0 ? campaign.adsets.data.map(adset => (
                    <div key={adset.id} style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                      {/* Ad Set Header */}
                      <div
                        onClick={() => setExpandedAdSets(prev => {
                          const next = new Set(prev);
                          if (next.has(adset.id)) next.delete(adset.id);
                          else next.add(adset.id);
                          return next;
                        })}
                        style={{ padding: "10px 14px", background: "var(--surface)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "var(--primary)", transition: "transform 0.2s", transform: expandedAdSets.has(adset.id) ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>▶</span>
                          <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adset.name}</span>
                          <Badge text={adset.effective_status} color={adset.effective_status === "ACTIVE" ? "var(--green)" : "var(--amber)"} bg={adset.effective_status === "ACTIVE" ? "var(--green-light)" : "var(--amber-light)"} />
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 20 }} onClick={(e) => e.stopPropagation()}>
                          {[
                            { label: "Edit", color: "var(--primary)", fn: () => handleEditAdSet(campaign.id, adset.id), disabled: false },
                            { label: "Run", color: "var(--green)", fn: () => handleUpdateStatus(adset.id, "AdSet", "ACTIVE", "run"), disabled: adset.effective_status === "ACTIVE" || updatingStatusId === adset.id },
                            { label: "Pause", color: "var(--amber)", fn: () => handleUpdateStatus(adset.id, "AdSet", "PAUSED", "pause"), disabled: adset.effective_status === "PAUSED" || updatingStatusId === adset.id },
                            { label: "Delete", color: "var(--red-strong)", fn: () => handleUpdateStatus(adset.id, "AdSet", null, "delete"), disabled: updatingStatusId === adset.id },
                          ].map(btn => (
                            <button key={btn.label} onClick={(e) => { e.stopPropagation(); btn.fn(); }} disabled={btn.disabled}
                              style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${btn.color}`, background: "transparent", color: btn.color, fontSize: 10, fontWeight: 700, cursor: btn.disabled ? "default" : "pointer", opacity: btn.disabled ? 0.45 : 1 }}
                            >{btn.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Ad Set Body (Ads) */}
                      {expandedAdSets.has(adset.id) && (
                        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12, background: "var(--card-bg)" }}>
                          {adset.ads?.data?.length > 0 ? adset.ads.data.map(ad => {
                            const insights = ad.insights?.data?.[0] || {};
                            return (
                              <div key={ad.id} style={{ padding: 12, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border-light)" }}>
                                {/* Ad header: thumbnail + name + status */}
                                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                                  <div style={{ width: 56, height: 56, borderRadius: 8, background: "#000", overflow: "hidden", flexShrink: 0, border: "1px solid var(--border-light)" }}>
                                    {ad.creative?.thumbnail_url
                                      ? <img src={ad.creative.thumbnail_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 18 }}>🎬</div>
                                    }
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{ad.name}</div>
                                      <Badge text={ad.effective_status} color={ad.effective_status === "ACTIVE" ? "var(--green)" : "var(--amber)"} bg={ad.effective_status === "ACTIVE" ? "var(--green-light)" : "var(--amber-light)"} />
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>ID: {ad.id}</div>
                                  </div>
                                </div>

                                {/* Metrics */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "8px 10px", background: "var(--card-bg)", borderRadius: 8, border: "1px solid var(--border-light)", marginBottom: 10 }}>
                                  {[
                                    { label: "Spend", value: `$${insights.spend || "0.00"}`, color: "var(--text)" },
                                    { label: "CTR", value: `${parseFloat(insights.inline_link_click_ctr || 0).toFixed(2)}%`, color: "var(--primary)" },
                                    { label: "Clicks", value: insights.clicks || "0", color: "var(--text)" },
                                  ].map(m => (
                                    <div key={m.label}>
                                      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>{m.label}</div>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Controls */}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {[
                                    { label: "Run", color: "var(--green)", disabled: ad.effective_status === "ACTIVE" || updatingStatusId === ad.id, fn: () => handleUpdateStatus(ad.id, "Ad", "ACTIVE", "run") },
                                    { label: "Pause", color: "var(--amber)", disabled: ad.effective_status === "PAUSED" || updatingStatusId === ad.id, fn: () => handleUpdateStatus(ad.id, "Ad", "PAUSED", "pause") },
                                    { label: "Delete", color: "var(--red-strong)", disabled: updatingStatusId === ad.id, fn: () => handleUpdateStatus(ad.id, "Ad", null, "delete") },
                                  ].map(btn => (
                                    <button key={btn.label} onClick={btn.fn} disabled={btn.disabled}
                                      style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${btn.color}`, background: "transparent", color: btn.color, fontSize: 11, fontWeight: 700, cursor: btn.disabled ? "default" : "pointer", opacity: btn.disabled ? 0.45 : 1 }}
                                    >{btn.label}</button>
                                  ))}
                                </div>
                              </div>
                            );
                          }) : <div style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: 10 }}>No ads found in this set.</div>}
                        </div>
                      )}
                    </div>
                  )) : <div style={{ fontSize: 13, color: "var(--text-dim)", padding: 20, textAlign: "center" }}>No ad sets found in this campaign.</div>}
                </div>
              )}
            </Card>
          ))}
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          AUTOMATED CAMPAIGNS
      ═══════════════════════════════════════════════════════ */}
      {tab === "ad_performance" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8, paddingBottom: 40 }}>
          <AdPerformance />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          REPORTS — Meta Ads Performance Dashboard
      ═══════════════════════════════════════════════════════ */}
      {tab === "reports" && (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 40, paddingTop: 8 }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ marginBottom: 10 }}>
            <div>
              <SectionTitle style={{ marginBottom: 4 }}>Meta Ads Performance</SectionTitle>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Real-time metrics and campaign performance directly from your Meta Ad Account.
              </div>
            </div>
            <button
              onClick={fetchMetaInsights}
              disabled={metaReportsLoading}
              style={{
                padding: "8px 16px", borderRadius: "10px", border: "1px solid var(--border)",
                background: "#fff", cursor: metaReportsLoading ? "not-allowed" : "pointer",
                fontSize: 13, display: "flex", alignItems: "center", gap: 8,
                opacity: metaReportsLoading ? 0.6 : 1, transition: "all 0.2s"
              }}
            >
              {metaReportsLoading ? <Spinner size={12} /> : "↻"} Refresh Data
            </button>
          </div>

          {metaReportsError && (
            <Card style={{ background: "var(--red-light)", border: "1px solid var(--red-strong)" }}>
              <div style={{ color: "var(--red-strong)", fontSize: 14 }}>{metaReportsError}</div>
            </Card>
          )}

          {!metaInsights && !metaReportsLoading && !metaReportsError && (
            <Card>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ready to load Meta Insights</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Sync your live Facebook ad metrics into the dashboard.</div>
                <button
                  onClick={fetchMetaInsights}
                  style={{
                    padding: "10px 24px", borderRadius: "var(--radius-md)", border: "none",
                    background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)"
                  }}
                >
                  Load Performance Data
                </button>
              </div>
            </Card>
          )}

          {metaReportsLoading && !metaInsights && (
            <Card>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", gap: 16 }}>
                <Spinner size={32} color="var(--primary)" />
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--primary)" }}>Connecting to Meta Graph API...</div>
              </div>
            </Card>
          )}

          {metaInsights && (
            <>
              {/* Account Level KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-3">
                <MetricCard
                  label="Total Spend"
                  value={`$${parseFloat(metaInsights.spend || 0).toFixed(2)}`}
                  sub="All Time"
                  color="var(--blue)" bg="var(--blue-light)"
                />
                <MetricCard
                  label="Impressions"
                  value={parseFloat(metaInsights.impressions || "0").toLocaleString()}
                  sub={`Reach: ${parseFloat(metaInsights.reach || "0").toLocaleString()}`}
                  color="var(--primary)" bg="var(--primary-light)"
                />
                <MetricCard
                  label="Link Clicks"
                  value={parseFloat(metaInsights.linkClicks || "0").toLocaleString()}
                  sub={`CTR: ${parseFloat(metaInsights.inline_link_click_ctr || 0).toFixed(2)}%`}
                  color="var(--amber)" bg="var(--amber-light)"
                />
                <MetricCard
                  label="Conversions"
                  value={parseFloat(metaInsights.leads || "0").toLocaleString()}
                  sub="Leads/Responses"
                  color="var(--green)" bg="var(--green-light)"
                />
              </div>

              {/* Campaign Breakdown */}
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Campaign Breakdown</span>
                </div>

                {metaCampaignInsights.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                    No campaigns found
                  </div>
                ) : typeof window !== "undefined" && window.innerWidth <= 768 ? (
                  /* ── MOBILE: card list ── */
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px" }}>
                    {metaCampaignInsights.map((c: any) => {
                      const ins = c.insights || {};
                      const isActive = c.effective_status === "ACTIVE";
                      return (
                        <div key={c.id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                          {/* Card header */}
                          <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            </div>
                            <div style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: isActive ? "#f0fdf4" : "#fffbeb", color: isActive ? "#16a34a" : "#d97706", border: `1px solid ${isActive ? "#86efac" : "#fde68a"}` }}>
                              {c.effective_status}
                            </div>
                          </div>
                          {/* Metrics */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: "12px 14px", gap: 6 }}>
                            {[
                              { label: "Spend", value: `$${parseFloat(ins.spend || 0).toFixed(2)}`, color: "#0f172a" },
                              { label: "Reach", value: parseFloat(ins.impressions || "0").toLocaleString(), color: "#0f172a" },
                              { label: "CTR", value: `${parseFloat(ins.inline_link_click_ctr || 0).toFixed(2)}%`, color: "#2563eb" },
                              { label: "Leads", value: parseFloat(ins.leads || "0").toLocaleString(), color: "#16a34a" },
                            ].map(m => (
                              <div key={m.label} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{m.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
                      <thead>
                        <tr style={{ background: "var(--card-bg)" }}>
                          <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>Campaign</th>
                          <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>Status</th>
                          <th style={{ padding: "12px 20px", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>Spend</th>
                          <th style={{ padding: "12px 20px", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>Impr.</th>
                          <th style={{ padding: "12px 20px", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>CTR</th>
                          <th style={{ padding: "12px 20px", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>Leads</th>
                          <th style={{ padding: "12px 20px", textAlign: "center", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metaCampaignInsights.map(c => {
                          const ins = c.insights || {};
                          return (
                            <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                              <td style={{ padding: "16px 20px" }}>
                                <div style={{ fontWeight: 600, color: "var(--text)" }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>ID: {c.id}</div>
                              </td>
                              <td style={{ padding: "16px 20px" }}>
                                <Badge
                                  text={c.effective_status}
                                  color={c.effective_status === "ACTIVE" ? "var(--green)" : "var(--amber)"}
                                  bg={c.effective_status === "ACTIVE" ? "var(--green-light)" : "var(--amber-light)"}
                                />
                              </td>
                              <td style={{ padding: "16px 20px", textAlign: "right", fontWeight: 600 }}>
                                ${parseFloat(ins.spend || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: "16px 20px", textAlign: "right" }}>
                                {parseFloat(ins.impressions || "0").toLocaleString()}
                              </td>
                              <td style={{ padding: "16px 20px", textAlign: "right", color: "var(--primary)", fontWeight: 600 }}>
                                {parseFloat(ins.inline_link_click_ctr || 0).toFixed(2)}%
                              </td>
                              <td style={{ padding: "16px 20px", textAlign: "right", fontWeight: 600 }}>
                                {parseFloat(ins.leads || "0").toLocaleString()}
                              </td>
                              <td style={{ padding: "16px 20px", textAlign: "center" }}>
                                <button
                                  onClick={() => setSelectedCampaignForReports(c)}
                                  style={{
                                    padding: "6px 12px", borderRadius: "10px", border: "1px solid var(--border)",
                                    background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500,
                                    color: "var(--primary)", transition: "all 0.15s"
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-light)"}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}  {/* end desktop table / mobile cards */}
              </Card>
            </>
          )}
        </div>
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
        <SocialOverview />
      )}
      {tab === "social-creator-studio" && (
        <div className="animate-fade-in sd-tab-wrapper">
          <SocialDash />
        </div>
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
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1200, margin: "0 auto", padding: "8px 0", width: "100%", boxSizing: "border-box" }}>

          {/* Page Header */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ClipboardList size={24} color="#3B82F6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0, lineHeight: 1.3 }}>Brand & ICP Configuration</h1>
                <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0 0" }}>Define your brand strategy and ideal customer profile</p>
              </div>
            </div>
            {/* Action buttons on their own row — always fully visible */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => setBrandSnapshotsModalOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 7, background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", marginRight: "auto", boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
              >
                <History size={15} color="#fff" />
                Saved Templates{brandSnapshots.length ? ` (${brandSnapshots.length})` : ""}
              </button>
              {!isEditingProfile ? (
                <button
                  onClick={handleStartEditingProfile}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", color: "#2563EB", border: "1.5px solid #2563EB", borderRadius: 10, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  ✏️ Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEditingProfile}
                    style={{ background: "#fff", color: "#64748B", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAsNewTemplate}
                    disabled={isSavingProfile}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", color: "#2563EB", border: "1.5px solid #2563EB", borderRadius: 10, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: isSavingProfile ? "not-allowed" : "pointer", opacity: isSavingProfile ? 0.7 : 1 }}
                  >
                    Save as new template
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontWeight: 600, fontSize: 13, cursor: isSavingProfile ? "not-allowed" : "pointer", opacity: isSavingProfile ? 0.7 : 1, boxShadow: "0 2px 8px rgba(37,99,235,0.25)" }}
                  >
                    {isSavingProfile ? <Spinner size={14} color="#fff" /> : "💾 Save"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Brand Strategy Section */}
          <div style={{ background: "#fff", borderRadius: 20, border: isActiveSavedTemplate && !isEditingProfile ? "1.5px solid #2563EB" : "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", background: isActiveSavedTemplate && !isEditingProfile ? "#EFF6FF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Megaphone size={20} color="#2563EB" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#2563EB" }}>Brand Strategy</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  {isActiveSavedTemplate && !isEditingProfile
                    ? <>Showing active template: <span style={{ fontWeight: 700, color: "#1E293B" }}>{activeBrandSnapshot.label || "Saved template"}</span></>
                    : "Define your brand positioning and core messaging"}
                </div>
              </div>
            </div>
            {[
              { key: "productsAndServices", label: "Products & Services", iconEl: <Tag size={16} color="#059669" />, iconBg: "#ECFDF5" },
              { key: "valueProposition", label: "Value Proposition", iconEl: <Gem size={16} color="#0D9488" />, iconBg: "#F0FDFA" },
              { key: "brandVoice", label: "Brand Voice", iconEl: <MessageSquare size={16} color="#7C3AED" />, iconBg: "#F5F3FF" },
              { key: "positioning", label: "Positioning", iconEl: <Target size={16} color="#EA580C" />, iconBg: "#FFF7ED" },
              { key: "competitors", label: "Competitors", iconEl: <Users size={16} color="#DB2777" />, iconBg: "#FDF2F8" },
              { key: "painPoints", label: "Pain Points", iconEl: <AlertTriangle size={16} color="#D97706" />, iconBg: "#FFFBEB" },
              { key: "destinationUrl", label: "Destination URL (Meta Ads)", iconEl: <LayoutGrid size={16} color="#2563EB" />, iconBg: "#EFF6FF", singleLine: true },
            ].map((f, i, arr) => (
              <div key={f.key} className="profile-field-row" style={{ padding: "14px 20px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: f.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {f.iconEl}
                  </div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{f.label}</label>
                </div>
                {f.singleLine ? (
                  <input
                    type="url"
                    value={displayProfileData[f.key]}
                    onChange={(e) => setProfileData({...profileData, [f.key]: e.target.value})}
                    disabled={!isEditingProfile}
                    placeholder="https://your-app.vercel.app/"
                    style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${isEditingProfile ? "#93C5FD" : "#E2E8F0"}`, borderRadius: 12, background: isEditingProfile ? "#fff" : "#F8FAFC", color: "#334155", outline: "none", fontFamily: "inherit", boxSizing: "border-box", cursor: isEditingProfile ? "text" : "default" }}
                  />
                ) : (
                <textarea
                  value={displayProfileData[f.key]}
                  onChange={(e) => setProfileData({...profileData, [f.key]: e.target.value})}
                  rows={2}
                  disabled={!isEditingProfile}
                  style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${isEditingProfile ? "#93C5FD" : "#E2E8F0"}`, borderRadius: 12, background: isEditingProfile ? "#fff" : "#F8FAFC", color: "#334155", outline: "none", resize: "none", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box", cursor: isEditingProfile ? "text" : "default" }}
                />
                )}
              </div>
            ))}
          </div>

          {/* ICP Fields Section */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Users size={20} color="#2563EB" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#2563EB" }}>ICP Fields (Separate Per Workflow)</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Define your ideal customer profile for targeted communication</div>
              </div>
            </div>
            {[
              { key: "icpMetaAds", label: "ICP - Meta Ads", iconEl: <LayoutGrid size={16} color="#059669" />, iconBg: "#ECFDF5" },
              { key: "icpNewsletter", label: "ICP - Newsletter", iconEl: <Mail size={16} color="#7C3AED" />, iconBg: "#F5F3FF" },
              { key: "icpOutreach", label: "ICP - Cold Email", iconEl: <Send size={16} color="#2563EB" />, iconBg: "#EFF6FF" },
            ].map((f, i, arr) => (
              <div key={f.key} className="profile-field-row" style={{ padding: "14px 20px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: f.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {f.iconEl}
                  </div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{f.label}</label>
                </div>
                <textarea
                  value={displayProfileData[f.key]}
                  onChange={(e) => setProfileData({...profileData, [f.key]: e.target.value})}
                  rows={2}
                  disabled={!isEditingProfile}
                  style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${isEditingProfile ? "#93C5FD" : "#E2E8F0"}`, borderRadius: 12, background: isEditingProfile ? "#fff" : "#F8FAFC", color: "#334155", outline: "none", resize: "none", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box", cursor: isEditingProfile ? "text" : "default" }}
                />
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
            <Info size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#64748B" }}>
              {isActiveSavedTemplate
                ? <>Save updates the active template <strong>{activeBrandSnapshot.label || "Saved template"}</strong>. Use Save as new template to keep a separate copy.</>
                : "Save updates your live brand. Use Save as new template to store a named version for Ads Lab."}
            </span>
          </div>

        </div>
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
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <History size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Saved Brand Templates</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>Stored prompts for Ads Lab — select one as your analysis basis</div>
              </div>
              <button
                onClick={() => setBrandSnapshotsModalOpen(false)}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                Active Context:{" "}
                <span style={{ fontWeight: 700, color: "#1E293B" }}>
                  {activeBrandContextLabel ?? "Loading brand context…"}
                </span>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {loadingBrandSnapshots ? (
                <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                  <Spinner size={24} color="#2563EB" />
                  <div style={{ marginTop: 12, fontSize: 13 }}>Loading templates…</div>
                </div>
              ) : brandSnapshots.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>No saved templates yet</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>Edit your brand strategy and save — you'll be asked to name each new template.</div>
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
                        border: `1.5px solid ${isActive ? "#2563EB" : "#E2E8F0"}`,
                        borderRadius: 14,
                        background: isActive ? "#EFF6FF" : "#fff",
                      }}
                    >
                      <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", lineHeight: 1.4 }}>
                            {snapshot.label || "Unnamed template"}
                          </div>
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Saved {savedDate}</div>
                          {snapshot.positioning && (
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 8, lineHeight: 1.5 }}>
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
                                ? { border: "none", background: "#1D4ED8", color: "#fff" }
                                : { border: "1px solid var(--primary-mid)", background: "var(--primary-mid)", color: "var(--primary-dark)" }),
                            }}
                          >
                            {isActive ? "✓ Active" : "Make Active"}
                          </button>
                          <button
                            onClick={() => setExpandedBrandSnapshotId(isExpanded ? null : snapshot.id)}
                            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            {isExpanded ? "Hide details" : "View prompts"}
                          </button>
                          <button
                            onClick={() => handleDeleteBrandSnapshot(snapshot)}
                            disabled={isActive || deletingSnapshotId === snapshot.id}
                            title={isActive ? "Switch to another template before deleting the active one" : undefined}
                            style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${isActive ? "#E2E8F0" : "#FECACA"}`, background: isActive ? "#F8FAFC" : "#FEF2F2", color: isActive ? "#94A3B8" : "#DC2626", fontSize: 11, fontWeight: 600, cursor: isActive || deletingSnapshotId === snapshot.id ? "not-allowed" : "pointer", opacity: deletingSnapshotId === snapshot.id ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                          >
                            {deletingSnapshotId === snapshot.id ? (
                              <Spinner size={12} color="#DC2626" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #E2E8F0", background: "#FAFBFC", borderRadius: "0 0 14px 14px" }}>
                          {[...BRAND_STRATEGY_FIELDS, ...BRAND_ICP_FIELDS].map(({ key, label }) => {
                            const value = snapshotProfile[key];
                            return (
                              <div key={key}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                                <div style={{ fontSize: 12, color: value ? "#334155" : "#94A3B8", lineHeight: 1.6, whiteSpace: "pre-wrap", fontStyle: value ? "normal" : "italic" }}>
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
            <div style={{ padding: "18px 22px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Save as new template</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                Give this version a name — it will be stored as a separate template for Ads Lab.
              </div>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8 }}>
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
                  border: "1.5px solid #93C5FD", borderRadius: 12,
                  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                <button
                  onClick={handleCancelTemplateName}
                  disabled={isSavingTemplateName}
                  style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Skip
                </button>
                <button
                  onClick={handleConfirmTemplateName}
                  disabled={isSavingTemplateName || !templateNameInput.trim()}
                  style={{
                    padding: "9px 20px", borderRadius: 10, border: "none",
                    background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 600,
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

        const currentAdInCreate = adTableLinks[adId];
        const currentAdInApproved = allApprovedAds.find(x => x.id === adId && x.time === adTime);

        // Prioritize live status from state
        const ad = (currentAdInCreate?.time === adTime ? currentAdInCreate : null)
          || currentAdInApproved
          || selectedAdForDetails;

        let jsonData: any = {};
        try {
          const raw = ad["json data"];
          jsonData = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
        } catch (e) { console.error("JSON parse error:", e); }

        const isVid = (ad.format || "").toLowerCase() === "video";
        const isMobileModal = typeof window !== "undefined" && window.innerWidth <= 768;

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
                border: "1px solid #e2e8f0",
              }}
            >
              {/* ── Modal Header ── */}
              <div style={{ padding: isMobileModal ? "12px 16px" : "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", background: isVid ? "#eff6ff" : "#fffbeb", color: isVid ? "#1d4ed8" : "#b45309", border: `1px solid ${isVid ? "#bfdbfe" : "#fde68a"}` }}>
                    {isVid ? "🎬 Video" : "🖼️ Image"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Ad ID: <span style={{ fontFamily: "monospace", color: "#475569" }}>{ad.id}</span></div>
                  {!isMobileModal && <div style={{ fontSize: 11, color: "#94a3b8" }}>· {new Date(ad.time).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isEditingAd && !isRetryingAd && (
                    <button
                      onClick={() => {
                        setIsEditingAd(true);
                        const firstAd = jsonData.ad || jsonData.ads?.[0] || {};
                        setEditingAdData({
                          campaignName: jsonData.campaign?.name || "Untitled Campaign",
                          adName: firstAd.name || "Untitled Ad",
                          headline: firstAd.headline || "No headline provided.",
                          primaryText: firstAd.primary_text || "",
                          ctaType: firstAd.call_to_action_type || "WATCH_MORE",
                          linkData: jsonData.link_data || ad.text || ""
                        });
                      }}
                      style={{ padding: "7px 16px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#2563eb", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      ✎ Edit
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedAdForDetails(null); setIsEditingAd(false); setIsRetryingAd(false); setRetryPrompt(""); }}
                    style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#fff", fontSize: 18, cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
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
                  flexShrink: 0, background: "#0f172a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRight: isMobileModal ? "none" : "1px solid #1e293b",
                  borderBottom: isMobileModal ? "1px solid #1e293b" : "none",
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
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Campaign Name</div>
                      {isEditingAd ? (
                        <input value={editingAdData.campaignName} onChange={(e) => setEditingAdData({ ...editingAdData, campaignName: e.target.value })}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #2563eb", background: "#fff", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{jsonData.campaign?.name || "Untitled Campaign"}</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Ad Name</div>
                      {isEditingAd ? (
                        <input value={editingAdData.adName} onChange={(e) => setEditingAdData({ ...editingAdData, adName: e.target.value })}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #2563eb", background: "#fff", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box" }} />
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{jsonData.ad?.name || jsonData.ads?.[0]?.name || "Untitled Ad"}</div>
                      )}
                    </div>
                  </div>

                  {/* Headline */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Ad Headline</div>
                    {isEditingAd ? (
                      <textarea value={editingAdData.headline} onChange={(e) => setEditingAdData({ ...editingAdData, headline: e.target.value })}
                        style={{ width: "100%", minHeight: 72, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #2563eb", background: "#fff", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", lineHeight: 1.6, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                        {jsonData.ad?.headline || jsonData.ads?.[0]?.headline || jsonData.description || "No headline provided."}
                      </div>
                    )}
                  </div>

                  {/* Primary Text */}
                  {(isEditingAd || jsonData.ad?.primary_text || jsonData.ads?.[0]?.primary_text) && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Primary Text</div>
                      {isEditingAd ? (
                        <textarea
                          value={editingAdData.primaryText || ""}
                          onChange={(e) => setEditingAdData({ ...editingAdData, primaryText: e.target.value })}
                          rows={4}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #2563eb", background: "#fff", fontSize: 13, lineHeight: 1.6, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                      ) : (
                        <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                          {jsonData.ad?.primary_text || jsonData.ads?.[0]?.primary_text}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA + Link */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobileModal ? "1fr" : "1fr 1fr", gap: isMobileModal ? 10 : 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Call to Action</div>
                      {isEditingAd ? (
                        <select value={editingAdData.ctaType} onChange={(e) => {
                          const newCta = e.target.value;
                          const suggestions: Record<string, string> = { WHATSAPP_MESSAGE: "+10000000000", CONTACT_US: `${DEFAULT_WEBSITE_URL}/contact`, MESSAGE_PAGE: `${DEFAULT_WEBSITE_URL}/contact` };
                          setEditingAdData({ ...editingAdData, ctaType: newCta, linkData: suggestions[newCta] || DEFAULT_WEBSITE_URL });
                        }} style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #2563eb", background: "#fff", fontSize: 13, fontWeight: 600, outline: "none" }}>
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
                        <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 14px", background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid #bfdbfe" }}>
                          {(jsonData.ad?.call_to_action_type || jsonData.ads?.[0]?.call_to_action_type || "WATCH_MORE").replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Destination URL</div>
                      {isEditingAd ? (
                        <input value={editingAdData.linkData} onChange={(e) => setEditingAdData({ ...editingAdData, linkData: e.target.value })}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #2563eb", background: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                      ) : (
                        <a href={jsonData.link_data || jsonData.ad?.website_url || ad.text} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                          {jsonData.ad?.website_url || jsonData.link_data ? (jsonData.ad?.website_url || jsonData.link_data) : "View media ↗"}
                        </a>
                      )}
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
                            background: isAdApproved(ad.Approved) ? "var(--green-light)" : "var(--primary)",
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            color: isAdApproved(ad.Approved) ? "var(--green)" : "#fff",
                            fontWeight: 700, fontSize: 13,
                            cursor: isAdApproved(ad.Approved) ? "default" : "pointer",
                            opacity: approvingId === (ad.id + "_" + ad.time) ? 0.7 : 1,
                            transition: "all 0.2s"
                          }}
                          disabled={isAdApproved(ad.Approved) || approvingId === (ad.id + "_" + ad.time)}
                          onClick={async () => {
                            await handleApproveAd(ad);
                          }}
                        >
                          {approvingId === (ad.id + "_" + ad.time) ? (
                            <Spinner size={12} />
                          ) : isAdApproved(ad.Approved) ? (
                            "✓ Approved"
                          ) : (
                            "✓ Approve Ad"
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
          ? "linear-gradient(135deg, #dc2626, #ef4444)"
          : "linear-gradient(135deg, #0284c7, #0ea5e9)";

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
              border: hasFailuresInModal ? "2px solid #ef4444" : "none",
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
                  style={{ background: "#fff", border: "none", color: hasFailuresInModal ? "#dc2626" : "#0284c7", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 800, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
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
                background: "#fef2f2", borderBottom: "2px solid #fecaca",
                padding: "12px 24px", display: "flex", flexDirection: "column", gap: 8
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#dc2626" }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  {modalFailures.length} scene(s) failed — highlighted in red below. Edit the prompt, save, close, then click <b>Start Again</b>.
                </div>
                {modalFailures.map((fail, fi) => (
                  <div key={fi} style={{
                    background: "#fff", border: "1px solid #fecaca", borderRadius: 8,
                    padding: "8px 14px", fontSize: 11, color: "#991b1b", lineHeight: 1.6
                  }}>
                    <span style={{ fontWeight: 700 }}>Error:</span> {fail.failMsg}
                  </div>
                ))}
              </div>
            )}

            {/* Column headers — hidden on mobile (cards show their own labels) */}
            <div className="scenes-modal-headers" style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr", padding: "10px 20px", background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>#</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 16 }}>🖼️ Image Prompt</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 16 }}>🎬 Video Scenario</div>
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
                  <div key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {/* Failed scene warning sub-header */}
                    {sceneIsFailed && (
                      <div style={{
                        padding: "6px 20px", background: "#fef2f2", borderBottom: "1px solid #fecaca",
                        fontSize: 11, fontWeight: 700, color: "#dc2626",
                        display: "flex", alignItems: "center", gap: 6
                      }}>
                        <span>⚠️ Scene {scene.scene} failed:</span>
                        <span style={{ fontWeight: 500 }}>{sceneFailMsg}</span>
                      </div>
                    )}
                    {/* ── Desktop: side-by-side grid | Mobile: stacked cards ── */}
                    {typeof window !== "undefined" && window.innerWidth > 768 ? (
                      /* DESKTOP — original 3-col grid */
                      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr", background: sceneIsFailed ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        {/* # */}
                        <div style={{ padding: "16px 8px", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 18 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: sceneIsFailed ? "#ef4444" : "#0284c7", color: "#fff", fontSize: 11, fontWeight: 800 }}>{scene.scene}</span>
                        </div>
                        {/* Image Prompt */}
                        <div style={{ padding: "12px 12px 12px 0", borderRight: "1px solid #e2e8f0" }}>
                          {scene.script_line && <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em", color: sceneIsFailed ? "#dc2626" : "#0284c7" }}>{scene.script_line}</div>}
                          <textarea value={scene.prompt_clean || scene.prompt || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],prompt_clean:e.target.value,prompt:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={5}
                            style={{ width:"100%", fontSize:11, color:"#334155", lineHeight:1.75, border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#f8fafc", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#ef4444":"#0284c7"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#e2e8f0"} />
                        </div>
                        {/* Video Scenario */}
                        <div style={{ padding: "12px 12px" }}>
                          <textarea value={scene.video_scenario || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],video_scenario:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={5}
                            style={{ width:"100%", fontSize:11, lineHeight:1.75, color: sceneIsFailed?"#991b1b":"#6d28d9", border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#f5f3ff", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#ef4444":"#7c3aed"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#e2e8f0"} />
                          {scene.emotion_type && (
                            <span style={{ marginTop:6, display:"inline-block", fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700, border:"1px solid", background: scene.emotion_type==="happy"?"#f0fdf4":scene.emotion_type==="sad"?"#eff6ff":"#fafafa", color: scene.emotion_type==="happy"?"#15803d":scene.emotion_type==="sad"?"#1d4ed8":"#64748b", borderColor: scene.emotion_type==="happy"?"#bbf7d0":scene.emotion_type==="sad"?"#bfdbfe":"#e2e8f0" }}>{scene.emotion_type}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* MOBILE — stacked card */
                      <div className="scene-row" style={{ padding:"14px 16px", background: sceneIsFailed?"#fff5f5":i%2===0?"#fff":"#f8fafc", display:"flex", flexDirection:"column", gap:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:"50%", background: sceneIsFailed?"#ef4444":"#0284c7", color:"#fff", fontSize:11, fontWeight:800, flexShrink:0 }}>{scene.scene}</span>
                          {scene.script_line && <div style={{ fontSize:11, fontWeight:700, color: sceneIsFailed?"#dc2626":"#0284c7", textTransform:"uppercase", letterSpacing:"0.04em" }}>{scene.script_line}</div>}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#0284c7", textTransform:"uppercase", letterSpacing:"0.05em" }}>🖼️ Image Prompt</div>
                          <textarea value={scene.prompt_clean || scene.prompt || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],prompt_clean:e.target.value,prompt:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={4}
                            style={{ width:"100%", fontSize:12, color:"#334155", lineHeight:1.6, border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #bfdbfe", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#eff6ff", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#ef4444":"#0284c7"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#bfdbfe"} />
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"0.05em" }}>🎬 Video Scenario</div>
                          <textarea value={scene.video_scenario || ""} onChange={e => { setEditedScenes((prev: any[]) => { const arr=[...prev]; arr[i]={...arr[i],video_scenario:e.target.value}; return arr; }); setHasUnsavedChanges(true); }} rows={4}
                            style={{ width:"100%", fontSize:12, lineHeight:1.6, color: sceneIsFailed?"#991b1b":"#6d28d9", border: sceneIsFailed?"1.5px solid #f87171":"1.5px solid #ddd6fe", borderRadius:8, padding:"10px 12px", resize:"vertical", fontFamily:"inherit", outline:"none", background: sceneIsFailed?"#fff1f2":"#f5f3ff", transition:"border 0.15s", boxSizing:"border-box" }}
                            onFocus={e=>e.target.style.borderColor=sceneIsFailed?"#ef4444":"#7c3aed"} onBlur={e=>e.target.style.borderColor=sceneIsFailed?"#f87171":"#ddd6fe"} />
                          {scene.emotion_type && (
                            <span style={{ marginTop:6, display:"inline-block", fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700, border:"1px solid", background: scene.emotion_type==="happy"?"#f0fdf4":scene.emotion_type==="sad"?"#eff6ff":"#fafafa", color: scene.emotion_type==="happy"?"#15803d":scene.emotion_type==="sad"?"#1d4ed8":"#64748b", borderColor: scene.emotion_type==="happy"?"#bbf7d0":scene.emotion_type==="sad"?"#bfdbfe":"#e2e8f0" }}>{scene.emotion_type}</span>
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
              border: "2px solid #ef4444", overflow: "hidden", display: "flex", flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🚫</span>
                <div style={{ fontSize: 13, color: "#991b1b", lineHeight: 1.5 }}><b>Violation reason: </b>{editingImagePrompt.reason}</div>
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
                    width: "100%", fontSize: 13, color: "#1e293b", lineHeight: 1.7,
                    border: "1.5px solid #f87171", borderRadius: 10, padding: "12px 14px",
                    resize: "vertical", fontFamily: "inherit", outline: "none",
                    background: "#fff1f2", boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = "#dc2626"}
                  onBlur={e => e.target.style.borderColor = "#f87171"}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setEditingImagePrompt(null)}
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", cursor: "pointer", padding: "10px 20px", fontSize: 13, fontWeight: 600 }}
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
                    background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", borderRadius: 10,
                    color: "#fff", cursor: "pointer", padding: "10px 24px", fontSize: 13, fontWeight: 700,
                    boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
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
              borderLeft: '6px solid #dc2626',
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
                  color: '#dc2626',
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
                    color: '#b91c1c',
                    margin: '0 0 4px 0',
                    lineHeight: '1.2'
                  }}
                >
                  Workflow Execution Error
                </h3>
                <p 
                  style={{
                    fontSize: '12px',
                    color: '#475569',
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
                  color: '#94a3b8',
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
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          fontFamily: "Inter, sans-serif"
        }}
        onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
        onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredInputs(null), 200); }}
        >
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                      <span key={i} style={{ padding: "4px 10px", background: "#EFF6FF", color: "#2563EB", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid #DBEAFE" }}>
                        {v}
                      </span>
                    ))}
                  </div>
                );
              } else if (typeof value === 'boolean') {
                displayValue = (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: value ? "#DCFCE7" : "#FEE2E2", color: value ? "#166534" : "#991B1B", border: `1px solid ${value ? "#BBF7D0" : "#FECACA"}` }}>
                    {value ? "✓ Enabled" : "✗ Disabled"}
                  </span>
                );
              } else if (typeof value === 'number') {
                displayValue = <span style={{ fontSize: 20, fontWeight: 800, color: "#1E293B", display: "block", marginTop: 2 }}>{value}</span>;
              } else {
                displayValue = <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", display: "block", marginTop: 4, textTransform: "capitalize" }}>{String(value).replace(/_/g, ' ')}</span>;
              }

              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", padding: "10px 12px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
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
