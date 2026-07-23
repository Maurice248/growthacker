"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Spinner, EditorialPage, EditorialPageHeader, EditorialSectionHeader, EditorialDefinitionList, EditorialDefinitionRow, EditorialField, EditorialPillButton, EditorialTextLink, EditorialStatusPill } from "./components";
import CustomSelect from "./CustomSelect";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const normalizeSupabaseUrl = (url: string | null | undefined) => {
  if (!url || typeof url !== "string") return url;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!base || !url.includes("/storage/v1/object/")) return url;
  const parts = url.split("/object/");
  if (parts.length < 2) return url;
  const path = parts[1].replace(/^(public\/|authenticated\/)/, "").split("/");
  return `${base}/storage/v1/object/public/${path[0]}/${path.slice(1).join("/")}`;
};

// ─── EMPTY CONFIG — all user-input fields are blank; only UI defaults kept ────
const DEFAULT_CONFIG: any = {
  campaign: {
    name: "",
    objective: "OUTCOME_TRAFFIC",
    buying_type: "AUCTION",
    special_ad_categories: ["NONE"],
    is_adset_budget_sharing_enabled: false,
  },
  ad_set: {
    name: "",
    daily_budget: 0,
    lifetime_budget: 0,
    budget_type: "DAILY",
    start_time: "",
    stop_time: "",
    has_end_date: false,
    age_min: 18,
    age_max: 65,
    gender: 0,
    geo_locations: { location_types: ["home", "recent"] },
    optimization_goal: "LINK_CLICKS",
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed", "story", "reels"],
    instagram_positions: ["stream", "story", "reels"],
  },
  ad: {
    id: Date.now(),
    name: "",
    type: "video",
    media_type: "video",
    headline: "",
    description: "",
    primary_text: "",
    website_url: "",
    display_link: "",
    call_to_action_type: "LEARN_MORE",
    facebook_page: "",
    instagram_account: "",
  },
  link_data: "",
};

type VariantCopy = {
  name: string;
  primary_text: string;
  description: string;
};

function conceptFromVariant(variant: { concept?: Record<string, unknown> }) {
  const concept = variant.concept || {};
  return ((concept.metadata as Record<string, unknown>) || concept) as Record<string, unknown>;
}

function variantLabel(variant: { role?: string; format?: string }, index: number) {
  if (variant.role === "base") return "Base variant";
  return `AI variant ${index}`;
}

// ─── PERSISTENCE KEYS ────────────────────────────────────────────────────────
const STORE_CONFIG   = "app_campaign_config";
const STORE_STEP     = "app_campaign_step";
const STORE_SEL_AD   = "app_campaign_sel_ad";
const STORE_LAST_AD  = "app_campaign_last_ad_text";

const CAMPAIGN_OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "Awareness", icon: "📢" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic", icon: "🌐" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement", icon: "💬" },
  { value: "OUTCOME_LEADS", label: "Leads", icon: "📋" },
  { value: "OUTCOME_SALES", label: "Sales", icon: "🛍️" },
];
const OPTIMIZATION_GOALS = [
  { value: "OFFSITE_CONVERSIONS", label: "Conversions" },
  { value: "LINK_CLICKS", label: "Link Clicks" },
  { value: "LANDING_PAGE_VIEWS", label: "Landing Page Views" },
  { value: "REACH", label: "Reach" },
  { value: "IMPRESSIONS", label: "Impressions" },
  { value: "POST_ENGAGEMENT", label: "Post Engagement" },
  { value: "LEAD_GENERATION", label: "Lead Generation" },
  { value: "QUALITY_LEAD", label: "Quality Lead" },
  { value: "THRUPLAY", label: "ThruPlay (Video)" },
];

// Valid optimization goals per campaign objective (Meta API rules)
const OBJECTIVE_GOAL_MAP: Record<string, string[]> = {
  OUTCOME_AWARENESS:  ["REACH", "IMPRESSIONS", "THRUPLAY"],
  OUTCOME_TRAFFIC:    ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS"],
  OUTCOME_ENGAGEMENT: ["POST_ENGAGEMENT", "LINK_CLICKS", "REACH", "IMPRESSIONS"],
  OUTCOME_LEADS:      ["LEAD_GENERATION", "QUALITY_LEAD", "LINK_CLICKS"],
  OUTCOME_SALES:      ["OFFSITE_CONVERSIONS", "LINK_CLICKS"],
};
const BUDGET_TYPES = [
  { value: "DAILY", label: "Daily Budget" },
  { value: "LIFETIME", label: "Lifetime Budget" },
];

const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "BOOK_TRAVEL", label: "Book Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "ORDER_NOW", label: "Order Now" },
  { value: "WATCH_MORE", label: "Watch More" },
];

interface CampaignSetupProps {
  onSelect: (campaign: any) => void;
  selectedId: string | null | undefined;
  selectedAd: any;
  approvedAds?: any[];
  variantAutomationId?: string | null;
  variantAds?: Array<{
    id: string;
    mediaUrl: string;
    format: string;
    role: string;
    concept?: Record<string, unknown>;
  }>;
  automationParams?: {
    numVariants: number;
    evalLengthDays: number;
    dailyBudgetCents: number;
  } | null;
}

const STEPS = [
  { num: 1, label: "Campaign", sub: "Objective & strategy" },
  { num: 2, label: "Ad Set", sub: "Targeting & budget" },
  { num: 3, label: "Ad Creative", sub: "Select & configure" },
];

export default function CampaignSetup({
  onSelect,
  selectedId,
  selectedAd,
  approvedAds: approvedAdsProp = [],
  variantAutomationId = null,
  variantAds = [],
  automationParams = null,
}: CampaignSetupProps) {
  const [step, setStep] = useState(1);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [launching, setLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchError, setLaunchError] = useState("");
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [hasLaunchedThisSegment, setHasLaunchedThisSegment] = useState(false);
  const [selectedApprovedAd, setSelectedApprovedAd] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);
  const lastAppliedAdRef = useRef<string | null>(null);
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [adSets, setAdSets] = useState<any[]>([]);
  const [adSetsLoading, setAdSetsLoading] = useState(false);
  const [variantCopyById, setVariantCopyById] = useState<Record<string, VariantCopy>>({});
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyError, setCopyError] = useState("");
  const variantCopyInitRef = useRef("");

  const hasVariantLaunch = variantAds.length > 0;
  const hasMultiVariantLaunch = variantAds.length > 1;
  const activeAd = selectedAd || (hasVariantLaunch ? { text: variantAds[0]?.mediaUrl, format: variantAds[0]?.format } : null);

  useEffect(() => {
    if (!hydrated || !automationParams) return;
    setConfig((prev: any) => ({
      ...prev,
      ad_set: {
        ...prev.ad_set,
        daily_budget: automationParams.dailyBudgetCents,
        budget_type: "DAILY",
      },
    }));
  }, [automationParams, hydrated]);

  const setField = (section: string, key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
    setHasLaunchedThisSegment(false);
  };

  // Fetch live campaigns
  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/meta/live-campaigns");
      const data = await res.json();
      if (res.ok) setCampaigns(data || []);
    } catch {}
    finally { setCampaignsLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Fetch ad sets when an existing campaign is selected
  useEffect(() => {
    if (!selectedId) {
      setAdSets([]);
      return;
    }
    let cancelled = false;
    setAdSetsLoading(true);
    fetch(`/api/meta/campaign-details?campaignId=${selectedId}`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setAdSets(data.adSets || []); })
      .catch(() => { if (!cancelled) setAdSets([]); })
      .finally(() => { if (!cancelled) setAdSetsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Reset ad set selection when user picks a different campaign
  useEffect(() => {
    if (prevSelectedIdRef.current === undefined) {
      prevSelectedIdRef.current = selectedId;
      return;
    }
    if (prevSelectedIdRef.current !== selectedId && selectedId) {
      setConfig((prev: any) => ({
        ...prev,
        ad_set: { ...prev.ad_set, existing_id: undefined, name: "" },
      }));
    }
    prevSelectedIdRef.current = selectedId;
  }, [selectedId]);

  const setAdSetSelection = (name: string, existingId?: string) => {
    setConfig((prev: any) => ({
      ...prev,
      ad_set: { ...prev.ad_set, name, existing_id: existingId || undefined },
    }));
    setHasLaunchedThisSegment(false);
  };

  // ── Restore persisted state on mount ──
  useEffect(() => {
    try {
      const legacyKeys: Record<string, string> = {
        toga_campaign_config: STORE_CONFIG,
        toga_campaign_step: STORE_STEP,
        toga_campaign_sel_ad: STORE_SEL_AD,
        toga_campaign_last_ad_text: STORE_LAST_AD,
      };
      Object.entries(legacyKeys).forEach(([oldKey, newKey]) => {
        const val = localStorage.getItem(oldKey);
        if (val !== null && localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, val);
        }
        localStorage.removeItem(oldKey);
      });

      const c = localStorage.getItem(STORE_CONFIG);
      const s = localStorage.getItem(STORE_STEP);
      const a = localStorage.getItem(STORE_SEL_AD);
      const t = localStorage.getItem(STORE_LAST_AD);
      if (c) setConfig(JSON.parse(c));
      if (s) setStep(JSON.parse(s));
      if (a) setSelectedApprovedAd(JSON.parse(a));
      if (t) lastAppliedAdRef.current = t;
    } catch {}
    setHydrated(true);
  }, []);

  // ── Persist config, step, selectedApprovedAd ──
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORE_CONFIG, JSON.stringify(config)); } catch {}
  }, [config, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORE_STEP, JSON.stringify(step)); } catch {}
  }, [step, hydrated]);

  useEffect(() => {
    if (!hydrated || !selectedApprovedAd) return;
    try { localStorage.setItem(STORE_SEL_AD, JSON.stringify(selectedApprovedAd)); } catch {}
  }, [selectedApprovedAd, hydrated]);

  // Apply selectedAd from Create Ad tab — sets media URL + type, and auto-fills ad copy from "json data" column
  useEffect(() => {
    if (!selectedAd) return;
    if (!hydrated) return;
    // Same ad already applied — keep user edits
    if (lastAppliedAdRef.current === (selectedAd.text || "")) return;
    // New ad selected — reset to empty config, set media fields only
    lastAppliedAdRef.current = selectedAd.text || "";
    try { localStorage.setItem(STORE_LAST_AD, selectedAd.text || ""); } catch {}
    const isVideo = (selectedAd.format || "").toLowerCase() === "video";

    // Parse "json data" column for ad copy auto-fill
    let adMeta: any = {};
    try {
      const raw = selectedAd["json data"];
      if (raw) {
        adMeta = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (e) {
      console.warn("[CampaignSetup] Failed to parse ad metadata from 'json data' column:", e);
    }

    const fresh: any = {
      ...DEFAULT_CONFIG,
      campaign: { ...DEFAULT_CONFIG.campaign },
      ad_set: { ...DEFAULT_CONFIG.ad_set },
      ad: {
        ...DEFAULT_CONFIG.ad,
        id: selectedAd.id || Date.now(),
        media_type: isVideo ? "video" : "image",
        type: isVideo ? "video" : "image",
        // Auto-fill from "json data" — fallback to empty string if not present
        name: adMeta.ad?.name || adMeta.ad_name || adMeta.ads?.[0]?.ad_name || DEFAULT_CONFIG.ad.name || "",
        primary_text:
          adMeta.ad?.primary_text ||
          adMeta.primary_text ||
          adMeta.ads?.[0]?.primary_text ||
          DEFAULT_CONFIG.ad.primary_text ||
          "",
        headline:
          adMeta.ad?.headline ||
          adMeta.headline ||
          adMeta.ads?.[0]?.headline ||
          DEFAULT_CONFIG.ad.headline ||
          "",
        description:
          adMeta.ad?.ad_description ||
          adMeta.ad_description ||
          adMeta.ads?.[0]?.ad_description ||
          DEFAULT_CONFIG.ad.description ||
          "",
        website_url:
          adMeta.ad?.website_url ||
          adMeta.ad?.destination_url ||
          adMeta.destination_url ||
          adMeta.ads?.[0]?.destination_url ||
          DEFAULT_CONFIG.ad.website_url ||
          "",
      },
      link_data: selectedAd.text || "",
    };
    setConfig(fresh);
    setStep(1);
    setStepErrors([]);
    setSelectedApprovedAd(selectedAd);
    // Clear stored state so fresh config persists
    try {
      localStorage.setItem(STORE_CONFIG, JSON.stringify(fresh));
      localStorage.setItem(STORE_STEP, JSON.stringify(1));
    } catch {}
  }, [selectedAd, hydrated]);

  useEffect(() => {
    if (!hydrated || !hasVariantLaunch) return;
    const first = variantAds[0];
    if (!first) return;
    const isVideo = first.format === "Video";
    const concept = first.concept || {};
    const metadata =
      (concept.metadata as Record<string, unknown>) ||
      (concept as Record<string, unknown>);
    setConfig((prev: any) => ({
      ...prev,
      ad: {
        ...prev.ad,
        media_type: isVideo ? "video" : "image",
        type: isVideo ? "video" : "image",
        name: (metadata.ad_name as string) || prev.ad?.name || "",
        primary_text: (metadata.primary_text as string) || prev.ad?.primary_text || "",
        headline: (metadata.headline as string) || prev.ad?.headline || "",
        website_url: (metadata.destination_url as string) || prev.ad?.website_url || "",
      },
      link_data: first.mediaUrl,
    }));
  }, [variantAds, hasVariantLaunch, hydrated]);

  useEffect(() => {
    if (!hydrated || !hasMultiVariantLaunch) return;
    const key = variantAds.map((v) => v.id).join(",");
    if (key === variantCopyInitRef.current) return;
    variantCopyInitRef.current = key;

    const next: Record<string, VariantCopy> = {};
    variantAds.forEach((variant, index) => {
      const metadata = conceptFromVariant(variant);
      next[variant.id] = {
        name:
          (metadata.ad_name as string) ||
          (index === 0 ? config.ad?.name : "") ||
          (index === 0 ? "Base variant" : `AI variant ${index}`),
        primary_text:
          (metadata.primary_text as string) ||
          (index === 0 ? config.ad?.primary_text : "") ||
          "",
        description:
          (metadata.ad_description as string) ||
          (index === 0 ? config.ad?.description : "") ||
          "",
      };
    });
    setVariantCopyById(next);
  }, [
    variantAds,
    hasMultiVariantLaunch,
    hydrated,
    config.ad?.name,
    config.ad?.primary_text,
    config.ad?.description,
  ]);

  const setVariantCopy = (variantId: string, field: keyof VariantCopy, value: string) => {
    setVariantCopyById((prev) => ({
      ...prev,
      [variantId]: {
        name: prev[variantId]?.name || "",
        primary_text: prev[variantId]?.primary_text || "",
        description: prev[variantId]?.description || "",
        [field]: value,
      },
    }));
    setHasLaunchedThisSegment(false);
  };

  const handleGenerateVariantCopy = async () => {
    if (!hasMultiVariantLaunch) return;
    const baseVariant = variantAds[0];
    const baseCopy = variantCopyById[baseVariant.id];
    if (!baseCopy?.name?.trim() || !baseCopy?.primary_text?.trim()) {
      setCopyError("Fill in the base variant ad name and primary text first.");
      return;
    }

    setGeneratingCopy(true);
    setCopyError("");
    try {
      const targets = variantAds.slice(1).map((variant, index) => {
        const metadata = conceptFromVariant(variant);
        const concept = variant.concept || {};
        return {
          id: variant.id,
          label: variantLabel(variant, index + 1),
          angle: (concept.angle as string) || (metadata.angle as string) || undefined,
          idea: (concept.idea as string) || (metadata.idea as string) || undefined,
        };
      });

      const res = await fetch("/api/meta/automation/generate-ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base: {
            name: baseCopy.name,
            primary_text: baseCopy.primary_text,
            description: baseCopy.description,
            headline: config.ad?.headline || "",
          },
          variants: targets,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate ad copy");

      setVariantCopyById((prev) => {
        const next = { ...prev };
        for (const variant of variantAds.slice(1)) {
          const generated = data.copies?.[variant.id];
          if (!generated) continue;
          next[variant.id] = {
            name: generated.name || next[variant.id]?.name || "",
            primary_text: generated.primary_text || next[variant.id]?.primary_text || "",
            description: generated.description || next[variant.id]?.description || "",
          };
        }
        return next;
      });
    } catch (err: unknown) {
      setCopyError(err instanceof Error ? err.message : "Failed to generate ad copy");
    } finally {
      setGeneratingCopy(false);
    }
  };

  useEffect(() => { setHasLaunchedThisSegment(false); }, [selectedId, selectedAd, variantAutomationId]);

  // Reset success banner when user navigates away from step 3 so the Launch button reappears on return
  useEffect(() => { if (step !== 3) { setLaunchSuccess(false); setHasLaunchedThisSegment(false); } }, [step]);

  const handleFullLaunch = async () => {
    setLaunching(true);
    setLaunchError("");
    setLaunchSuccess(false);
    setLaunchStep(1);
    try {
      const sanitizedConfig = {
        ...config,
        ad_set: {
          ...config.ad_set,
          age_min: Number(config.ad_set?.age_min) || 18,
          age_max: Number(config.ad_set?.age_max) || 65,
          daily_budget: Number(config.ad_set?.daily_budget) || (automationParams?.dailyBudgetCents ?? 5000),
          lifetime_budget: Number(config.ad_set?.lifetime_budget) || 50000,
        },
      };

      const buildAdPayload = (variant: {
        id?: string;
        mediaUrl: string;
        format: string;
        concept?: Record<string, unknown>;
      }, index: number) => {
        const concept = variant.concept || {};
        const metadata =
          (concept.metadata as Record<string, unknown>) ||
          (concept as Record<string, unknown>);
        const perVariantCopy =
          variant.id && hasMultiVariantLaunch ? variantCopyById[variant.id] : null;
        const isVideo = variant.format === "Video";
        return {
          link_data: variant.mediaUrl,
          ad: {
            ...sanitizedConfig.ad,
            id: Date.now() + index,
            name:
              perVariantCopy?.name?.trim() ||
              (metadata.ad_name as string) ||
              (concept.headline as string) ||
              `${sanitizedConfig.ad?.name || "Ad"} ${index + 1}`,
            media_type: isVideo ? "video" : "image",
            type: isVideo ? "video" : "image",
            headline:
              (metadata.headline as string) ||
              sanitizedConfig.ad?.headline ||
              "",
            primary_text:
              perVariantCopy?.primary_text?.trim() ||
              (metadata.primary_text as string) ||
              sanitizedConfig.ad?.primary_text ||
              "",
            description:
              perVariantCopy?.description?.trim() ||
              (metadata.ad_description as string) ||
              sanitizedConfig.ad?.description ||
              "",
            website_url:
              (metadata.destination_url as string) ||
              sanitizedConfig.ad?.website_url ||
              "",
            call_to_action_type: sanitizedConfig.ad?.call_to_action_type || "LEARN_MORE",
          },
        };
      };

      const adsPayload = hasVariantLaunch
        ? variantAds.map((variant, index) => buildAdPayload(variant, index))
        : undefined;

      const res = await fetch("/api/meta/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: sanitizedConfig,
          campaignId: selectedId || null,
          ads: adsPayload,
        }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 100)}`); }
      if (res.ok) {
        if (variantAutomationId) {
          await fetch(`/api/meta/automation/${variantAutomationId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "finalize_launch",
              schema: sanitizedConfig,
              campaignId: data.campaignId || selectedId || null,
              adSetId: data.adSetId || null,
              adIds: data.adIds || (data.adId ? [data.adId] : []),
              generation: 1,
            }),
          });
        }
        setLaunchStep(5);
        setLaunchSuccess(true);
        setHasLaunchedThisSegment(true);
        await fetchCampaigns();
      } else {
        let msg = data.error || "Launch failed";
        if (msg.includes("1885760")) msg = "Goal Mismatch: Click 'Reset Selection' to launch as a New Pathway, or match the existing campaign's goal.";
        setLaunchError(msg);
        setLaunchStep(0);
      }
    } catch (e: any) {
      setLaunchError(e.message || "Launch failed");
      setLaunchStep(0);
    } finally { setLaunching(false); }
  };

  const validateStep = (s: number): string[] => {
    const errs: string[] = [];
    if (s === 1) {
      // Campaign name only required when creating a new campaign, not when appending to existing
      if (!selectedId && !config.campaign?.name?.trim()) errs.push("Campaign Name is required.");
    }
    if (s === 2) {
      if (!config.ad_set?.name?.trim()) errs.push("Ad Set Name is required.");
      const usingExistingAdSet = !!config.ad_set?.existing_id;
      if (!usingExistingAdSet) {
        const geo = config.ad_set?.geo_locations;
        const hasGeo = (geo?.countries?.length > 0) || (geo?.cities?.length > 0) || (geo?.regions?.length > 0);
        if (!hasGeo) errs.push("At least one Target Location is required.");
        const budget = config.ad_set?.budget_type === "DAILY" ? config.ad_set?.daily_budget : config.ad_set?.lifetime_budget;
        if (!budget || Number(budget) <= 0) errs.push("Budget amount must be greater than 0.");
        if (!config.ad_set?.start_time) errs.push("Start Date is required.");
      }
    }
    if (s === 3) {
      if (hasMultiVariantLaunch) {
        variantAds.forEach((variant, index) => {
          const copy = variantCopyById[variant.id];
          const label = variantLabel(variant, index);
          if (!copy?.name?.trim()) errs.push(`Ad Name is required for ${label}.`);
          if (!copy?.primary_text?.trim()) errs.push(`Primary Text is required for ${label}.`);
        });
      } else {
        if (!config.ad?.name?.trim()) errs.push("Ad Name is required.");
        if (!config.ad?.primary_text?.trim()) errs.push("Primary Text is required.");
      }
      if (!config.ad?.headline?.trim()) errs.push("Headline is required.");
      const url = config.ad?.website_url?.trim();
      if (!url) {
        errs.push("Destination URL is required.");
      } else {
        try { new URL(url); if (!/^https?:\/\/.+\..+/.test(url)) throw new Error(); }
        catch { errs.push("Destination URL is invalid. Must start with https:// or http:// (e.g. https://example.com)."); }
      }
    }
    return errs;
  };

  const handleNext = () => {
    const errs = validateStep(step);
    if (errs.length > 0) { setStepErrors(errs); return; }
    setStepErrors([]);
    setStep(step + 1);
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedId);
  const isAdVideo = config.ad?.media_type === "video" || config.ad?.type === "video";
  const mediaUrl = config.link_data || "";

  return (
    <EditorialPage wide>
      <EditorialPageHeader
        eyebrow="Meta Ads Manager"
        title="Campaign Setup"
        subtitle="Build and launch your Meta Ads campaign step by step."
      />

      {/* ── No Ad Selected Gate ── */}
      {!activeAd && (
        <div style={{
          borderTop: "1px dashed #C2B79A",
          padding: "40px 0", marginBottom: 40, textAlign: "left",
        }}>
          <EditorialSectionHeader title="Select an Ad First" />
          <p style={{ fontSize: 15, color: "#4A5A64", margin: "16px 0 24px", lineHeight: 1.7, maxWidth: 520 }}>
            Before setting up a campaign, go to the <strong>Create Ad</strong> tab, approve an ad in <strong>Ad Previews</strong>, then click <strong>&ldquo;Send to setup&rdquo;</strong>.
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", fontSize: 14, color: "#8C8474" }}>
            <span>1. Create Ad</span>
            <span>→</span>
            <span>2. Send to setup</span>
            <span>→</span>
            <span style={{ color: "#003049", fontWeight: 700 }}>3. Campaign Setup</span>
          </div>
        </div>
      )}

      {/* ── Stepper ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid #003049", borderBottom: "1px solid #E8DCC2", marginBottom: 40, opacity: activeAd ? 1 : 0.4, pointerEvents: activeAd ? "auto" : "none" }}>
        {STEPS.map((s, i) => {
          const done = step > s.num;
          const active = step === s.num;
          return (
            <div
              key={s.num}
              onClick={() => { if (done) setStep(s.num); }}
              style={{
                display: "flex", gap: 14, alignItems: "center",
                padding: i === 0 ? "18px 24px 18px 0" : i === STEPS.length - 1 ? "18px 0 18px 24px" : "18px 24px",
                borderRight: i < STEPS.length - 1 ? "1px solid #E8DCC2" : "none",
                cursor: done ? "pointer" : "default",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)",
                background: done || active ? "#C1121F" : "transparent",
                color: done || active ? "#FDF6E3" : "#8C8474",
                border: done || active ? "none" : "1px solid #C2B79A",
              }}>
                {done ? "✓" : s.num}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: active ? 700 : 600, fontSize: 15, color: active ? "#C1121F" : done ? "#003049" : "#4A5A64" }}>{s.label}</div>
                <div style={{ fontSize: 12.5, color: "#8C8474", marginTop: 2 }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          STEP 1 — CAMPAIGN
      ══════════════════════════════════════════════ */}
      {step === 1 && activeAd && (
        <>
          {/* Existing Campaigns */}
          <section>
            <EditorialSectionHeader
              title="Existing Campaigns"
              meta={<EditorialTextLink onClick={fetchCampaigns} style={{ fontSize: 13 }}>Refresh</EditorialTextLink>}
            />
            <p style={{ margin: "14px 0 4px", fontSize: 13.5, color: "#8C8474" }}>Select one to append a new ad set, or start fresh below.</p>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {campaignsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spinner size={20} /></div>
              ) : campaigns.length === 0 ? (
                <div style={{ padding: "24px 0", color: "#9FA8A3", fontSize: 13, borderTop: "1px solid #E8DCC2" }}>No campaigns found</div>
              ) : (
                campaigns.map((c: any) => {
                  const isSelected = selectedId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => onSelect(isSelected ? null : c)}
                      style={{
                        display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: "0 24px",
                        padding: "18px 0", borderBottom: "1px solid #E8DCC2", alignItems: "center", cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        background: isSelected ? "#C1121F" : "transparent",
                        color: isSelected ? "#FDF6E3" : "transparent",
                        border: isSelected ? "none" : "1px solid #C2B79A",
                      }}>
                        {isSelected ? "✓" : ""}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: isSelected ? 700 : 600, fontSize: 16, color: isSelected ? "#C1121F" : "#003049", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                        <div style={{ fontSize: 12.5, color: "#8C8474", marginTop: 2 }}>ID · {c.id}</div>
                      </div>
                      <div style={{ fontSize: 13, color: isSelected ? "#003049" : "transparent", fontWeight: 700 }}>{isSelected ? "Selected" : ""}</div>
                      <EditorialStatusPill variant={c.effective_status === "ACTIVE" ? "active" : "neutral"}>{c.effective_status}</EditorialStatusPill>
                    </div>
                  );
                })
              )}
            </div>

            {selectedId && (
              <EditorialDefinitionList>
                <EditorialDefinitionRow label="Appending to" isLast>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#003049" }}>
                    {selectedCampaign?.name || selectedId}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#8C8474", marginTop: 3 }}>
                    Campaign-level fields are locked when appending. Select an existing ad set or create a new one in step 2.
                  </div>
                </EditorialDefinitionRow>
              </EditorialDefinitionList>
            )}
          </section>

          {!selectedId && (
            <section style={{ marginTop: 48 }}>
              <EditorialSectionHeader title="New Campaign" meta="Configure your new campaign." />
              <EditorialDefinitionList>
                <EditorialDefinitionRow label="Campaign name">
                  <EditorialField
                    value={config.campaign?.name || ""}
                    onChange={(v) => setField("campaign", "name", v)}
                    placeholder="Enter campaign name"
                  />
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Campaign objective">
                  <CustomSelect
                    value={config.campaign?.objective || ""}
                    onChange={v => {
                      setField("campaign", "objective", v);
                      const allowed = OBJECTIVE_GOAL_MAP[v] || [];
                      const currentGoal = config.ad_set?.optimization_goal;
                      if (currentGoal && !allowed.includes(currentGoal)) {
                        setField("ad_set", "optimization_goal", allowed[0] || "LINK_CLICKS");
                      }
                    }}
                    options={CAMPAIGN_OBJECTIVES.map(o => ({ value: o.value, label: `${o.icon} ${o.label}` }))}
                  />
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Buying type" isLast>
                  <CustomSelect
                    value={config.campaign?.buying_type || "AUCTION"}
                    onChange={v => setField("campaign", "buying_type", v)}
                    options={[{ value: "AUCTION", label: "Auction" }, { value: "REACH", label: "Reach" }]}
                  />
                </EditorialDefinitionRow>
              </EditorialDefinitionList>
            </section>
          )}

          <section style={{ marginTop: 48 }}>
            <EditorialSectionHeader title="Placements" meta="Choose where your ads appear" />
            <PlacementsSection config={config} setField={setField} />
          </section>

          {stepErrors.length > 0 && (
            <div style={{ background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, marginTop: 24 }}>
              {stepErrors.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#780000", display: "flex", gap: 6 }}><span>•</span>{e}</div>)}
            </div>
          )}
          <NavButtons step={step} setStep={setStep} onNext={handleNext} isFirst isLast={false} />
        </>
      )}

      {/* ══════════════════════════════════════════════
          STEP 2 — AD SET
      ══════════════════════════════════════════════ */}
      {step === 2 && activeAd && (
        <>
          <section>
            <SectionHeader title="Targeting" sub="Define your audience and locations." />
            <EditorialDefinitionList>
              <EditorialDefinitionRow label="Ad set name">
                {selectedId ? (
                  <AdSetNameInput
                    adSets={adSets}
                    loading={adSetsLoading}
                    name={config.ad_set?.name || ""}
                    existingId={config.ad_set?.existing_id}
                    onChange={setAdSetSelection}
                  />
                ) : (
                  <EditorialField
                    value={config.ad_set?.name || ""}
                    onChange={(v) => setField("ad_set", "name", v)}
                    placeholder="Enter ad set name"
                  />
                )}
              </EditorialDefinitionRow>
              {config.ad_set?.existing_id && (
                <EditorialDefinitionRow label="Note">
                  <div style={{ fontSize: 13.5, color: "#4A5A64", lineHeight: 1.6 }}>
                    Using existing ad set — budget and targeting on Meta will be kept as-is. Only the new ad creative will be added.
                  </div>
                </EditorialDefinitionRow>
              )}
              <EditorialDefinitionRow label="Target locations">
                <LocationSearch geoLocations={config.ad_set?.geo_locations} onChange={v => setField("ad_set", "geo_locations", v)} />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Optimisation goal" isLast>
                <CustomSelect
                  value={config.ad_set?.optimization_goal || ""}
                  onChange={v => setField("ad_set", "optimization_goal", v)}
                  options={(() => {
                    const objective = config.campaign?.objective || "OUTCOME_TRAFFIC";
                    const allowed = OBJECTIVE_GOAL_MAP[objective] || OPTIMIZATION_GOALS.map(g => g.value);
                    return OPTIMIZATION_GOALS.filter(g => allowed.includes(g.value)).map(g => ({ value: g.value, label: g.label }));
                  })()}
                />
              </EditorialDefinitionRow>
            </EditorialDefinitionList>
          </section>

          <section style={{ marginTop: 48 }}>
            <SectionHeader title="Budget & Schedule" sub="Set your spending limits and campaign dates." />
            <EditorialDefinitionList>
              <EditorialDefinitionRow label="Budget type">
                <CustomSelect
                  value={config.ad_set?.budget_type || "DAILY"}
                  onChange={v => setField("ad_set", "budget_type", v)}
                  options={BUDGET_TYPES.map(b => ({ value: b.value, label: b.label }))}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label={`Amount (${config.ad_set?.budget_type === "DAILY" ? "Daily" : "Lifetime"}) USD`}>
                <div style={{ position: "relative", maxWidth: 220 }}>
                  <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", color: "#8C8474", fontWeight: 600 }}>$</span>
                  <EditorialField
                    value={
                      config.ad_set?.budget_type === "DAILY"
                        ? String(config.ad_set?.daily_budget / 100 || "")
                        : String(config.ad_set?.lifetime_budget / 100 || "")
                    }
                    onChange={(v) => {
                      const key = config.ad_set?.budget_type === "DAILY" ? "daily_budget" : "lifetime_budget";
                      setField("ad_set", key, Math.round(Number(v) * 100));
                    }}
                    placeholder="0.00"
                  />
                </div>
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Start date">
                <input type="datetime-local" value={config.ad_set?.start_time || ""} onChange={e => setField("ad_set", "start_time", e.target.value)} style={{ ...inputSt, border: "none", borderBottom: "1px solid #C2B79A", borderRadius: 0, padding: "10px 0", background: "transparent" }} />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="End date" isLast>
                {config.ad_set?.has_end_date ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="datetime-local"
                      value={config.ad_set?.stop_time || ""}
                      onChange={e => setField("ad_set", "stop_time", e.target.value)}
                      style={{ ...inputSt, flex: 1, border: "none", borderBottom: "1px solid #C2B79A", borderRadius: 0, padding: "10px 0", background: "transparent", boxSizing: "border-box" }}
                    />
                    <EditorialTextLink onClick={() => { setField("ad_set", "has_end_date", false); setField("ad_set", "stop_time", ""); }}>
                      Remove
                    </EditorialTextLink>
                  </div>
                ) : (
                  <EditorialTextLink onClick={() => setField("ad_set", "has_end_date", true)}>
                    + Add end date
                  </EditorialTextLink>
                )}
              </EditorialDefinitionRow>
            </EditorialDefinitionList>
          </section>

          <section style={{ marginTop: 48 }}>
            <SectionHeader title="Demographics" sub="Define age range and gender targeting." />
            <EditorialDefinitionList>
              <EditorialDefinitionRow label="Gender">
                <CustomSelect
                  value={String(config.ad_set?.gender ?? 0)}
                  onChange={v => setField("ad_set", "gender", Number(v))}
                  options={[{ value: "0", label: "All" }, { value: "1", label: "Male" }, { value: "2", label: "Female" }]}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Min age">
                <EditorialField
                  value={String(config.ad_set?.age_min ?? "")}
                  onChange={(v) => setField("ad_set", "age_min", v === "" ? "" : Number(v))}
                  placeholder="18"
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Max age" isLast>
                <EditorialField
                  value={String(config.ad_set?.age_max ?? "")}
                  onChange={(v) => setField("ad_set", "age_max", v === "" ? "" : Number(v))}
                  placeholder="65"
                />
              </EditorialDefinitionRow>
            </EditorialDefinitionList>
          </section>

          {stepErrors.length > 0 && (
            <div style={{ background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, marginTop: 24 }}>
              {stepErrors.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#780000", display: "flex", gap: 6 }}><span>•</span>{e}</div>)}
            </div>
          )}
          <NavButtons step={step} setStep={setStep} onNext={handleNext} isFirst={false} isLast={false} />
        </>
      )}

      {/* ══════════════════════════════════════════════
          STEP 3 — AD CREATIVE
      ══════════════════════════════════════════════ */}
      {step === 3 && activeAd && (
        <>
          <section>
            <SectionHeader
              title={hasVariantLaunch ? "Variant set" : "Selected ad"}
              sub={
                hasVariantLaunch
                  ? `${variantAds.length} ads will launch together in one ad set.`
                  : selectedAd
                    ? "Ad selected from Create Ad."
                    : `Pick an approved creative.${approvedAdsProp.length > 0 ? ` ${approvedAdsProp.length} available.` : ""}`
              }
            />
            {(() => {
              const adsToShow = hasVariantLaunch
                ? variantAds.map((variant) => ({
                    id: variant.id,
                    text: variant.mediaUrl,
                    format: variant.format,
                    role: variant.role,
                  }))
                : selectedAd
                  ? [selectedAd]
                  : approvedAdsProp;
              if (adsToShow.length === 0) {
                return (
                  <div style={{ padding: "32px 0", color: "#9FA8A3", fontSize: 13.5, lineHeight: 1.6 }}>
                    No approved ads yet. Go to the <strong>Create Ad</strong> tab and approve a creative in Ad Previews first.
                  </div>
                );
              }
              const gridCols = hasVariantLaunch || selectedAd
                ? "repeat(auto-fill, minmax(180px, 220px))"
                : "repeat(auto-fill, minmax(160px, 1fr))";
              return (
                <div
                  className="editorial-preview-grid"
                  style={{ display: "grid", gridTemplateColumns: gridCols, gap: 28, paddingTop: 24 }}
                >
                  {adsToShow.map((ad: any, adIdx: number) => {
                    const isVid = (ad.format || "").toLowerCase() === "video";
                    const isSelected = hasVariantLaunch || selectedApprovedAd?.text === ad.text;
                    const formatLabel = ad.role === "base" ? "Base variant" : isVid ? "Video" : "Image";
                    return (
                      <AdCreativePreviewCard
                        key={`${ad.id}-${adIdx}`}
                        ad={ad}
                        isVideo={isVid}
                        isSelected={isSelected}
                        formatLabel={formatLabel}
                        selectable={!hasVariantLaunch}
                        onSelect={() => {
                          if (hasVariantLaunch) return;
                          setSelectedApprovedAd(ad);
                          setConfig((prev: any) => ({
                            ...prev,
                            link_data: ad.text,
                            ad: { ...prev.ad, media_type: isVid ? "video" : "image", type: isVid ? "video" : "image" },
                          }));
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </section>

          <section style={{ marginTop: 48 }}>
            <SectionHeader
              title="Ad copy & identity"
              sub={
                hasMultiVariantLaunch
                  ? "Each variant needs its own ad name, primary text, and description. Fill in the base variant, then generate the rest."
                  : "Customize the text and CTA for your ad."
              }
            />

            {hasMultiVariantLaunch ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {variantAds.map((variant, index) => {
                  const copy = variantCopyById[variant.id] || { name: "", primary_text: "", description: "" };
                  const isVideo = variant.format === "Video";
                  const label = variantLabel(variant, index);
                  return (
                    <div key={variant.id} style={{ borderTop: "1px solid #E8DCC2", paddingTop: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                        <div style={{ width: 48, height: 60, borderRadius: 8, overflow: "hidden", background: "#003049", flexShrink: 0 }}>
                          {isVideo ? (
                            <video src={variant.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <img src={variant.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#003049" }}>{label}</div>
                          <div style={{ fontSize: 13, color: "#8C8474", marginTop: 3, lineHeight: 1.5 }}>
                            {index === 0
                              ? "Write this first — other variants can be generated from it."
                              : "Unique ad name, primary text, and description for this creative."}
                          </div>
                        </div>
                      </div>
                      <EditorialDefinitionList>
                        <EditorialDefinitionRow label="Ad name">
                          <EditorialField value={copy.name} onChange={(v) => setVariantCopy(variant.id, "name", v)} />
                        </EditorialDefinitionRow>
                        <EditorialDefinitionRow label="Primary text">
                          <EditorialField value={copy.primary_text} onChange={(v) => setVariantCopy(variant.id, "primary_text", v)} multiline rows={4} />
                        </EditorialDefinitionRow>
                        <EditorialDefinitionRow label="Ad description" isLast>
                          <EditorialField value={copy.description} onChange={(v) => setVariantCopy(variant.id, "description", v)} />
                        </EditorialDefinitionRow>
                      </EditorialDefinitionList>
                    </div>
                  );
                })}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
                  <EditorialPillButton onClick={handleGenerateVariantCopy} disabled={generatingCopy} style={{ alignSelf: "flex-start" }}>
                    {generatingCopy ? <Spinner size={14} color="#FDF0D5" /> : null}
                    {generatingCopy ? "Generating copy..." : `Generate ad copy for variants 2–${variantAds.length}`}
                  </EditorialPillButton>
                  {copyError && <div style={{ fontSize: 13, color: "#C1121F", fontWeight: 600 }}>{copyError}</div>}
                </div>

                <EditorialDefinitionList>
                  <EditorialDefinitionRow label="Headline">
                    <EditorialField value={config.ad?.headline || ""} onChange={(v) => setField("ad", "headline", v)} />
                  </EditorialDefinitionRow>
                  <EditorialDefinitionRow label="Call to action" isLast>
                    <CustomSelect
                      variant="editorial"
                      value={config.ad?.call_to_action_type || "LEARN_MORE"}
                      onChange={(v) => setField("ad", "call_to_action_type", v)}
                      options={CTA_OPTIONS}
                    />
                  </EditorialDefinitionRow>
                </EditorialDefinitionList>
              </div>
            ) : (
              <EditorialDefinitionList>
                <EditorialDefinitionRow label="Ad name">
                  <EditorialField value={config.ad?.name || ""} onChange={(v) => setField("ad", "name", v)} />
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Primary text">
                  <EditorialField value={config.ad?.primary_text || ""} onChange={(v) => setField("ad", "primary_text", v)} multiline rows={4} />
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Headline">
                  <EditorialField value={config.ad?.headline || ""} onChange={(v) => setField("ad", "headline", v)} />
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Call to action">
                  <CustomSelect
                    variant="editorial"
                    value={config.ad?.call_to_action_type || "LEARN_MORE"}
                    onChange={(v) => setField("ad", "call_to_action_type", v)}
                    options={CTA_OPTIONS}
                  />
                </EditorialDefinitionRow>
                <EditorialDefinitionRow label="Ad description" isLast>
                  <EditorialField value={config.ad?.description || ""} onChange={(v) => setField("ad", "description", v)} />
                </EditorialDefinitionRow>
              </EditorialDefinitionList>
            )}

            {(() => {
              const url = config.ad?.website_url?.trim();
              let urlValid = true;
              if (url) {
                try {
                  new URL(url);
                  if (!/^https?:\/\/.+\..+/.test(url)) throw new Error();
                } catch {
                  urlValid = false;
                }
              }
              return (
                <div
                  className={`editorial-field-highlight${urlValid ? "" : " editorial-field-highlight--error"}`}
                  style={{
                  marginTop: 8,
                  padding: "20px 24px",
                  background: urlValid ? "#E7F0F6" : "#F9E3E0",
                  borderRadius: 12,
                  border: `1px solid ${urlValid ? "#C2D6E2" : "#fca5a5"}`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: urlValid ? "#1A4A66" : "#C1121F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Destination URL *
                  </div>
                  <EditorialField
                    value={config.ad?.website_url || ""}
                    onChange={(v) => setField("ad", "website_url", v)}
                    placeholder="https://example.com"
                  />
                  {url && !urlValid && (
                    <div style={{ fontSize: 12, color: "#C1121F", marginTop: 8, fontWeight: 600 }}>
                      Invalid URL — must start with https:// or http://
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {stepErrors.length > 0 && (
            <div style={{ background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, marginTop: 24 }}>
              {stepErrors.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#780000", display: "flex", gap: 6 }}><span>•</span>{e}</div>)}
            </div>
          )}
          <NavButtons step={step} setStep={setStep} onNext={handleNext} isFirst={false} isLast />

          <LaunchPanel
            launchSuccess={launchSuccess}
            launching={launching}
            launchStep={launchStep}
            launchError={launchError}
            hasLaunchedThisSegment={hasLaunchedThisSegment}
            selectedId={selectedId}
            selectedCampaignName={selectedCampaign?.name}
            adSetName={config.ad_set?.name}
            existingAdSetId={config.ad_set?.existing_id}
            onLaunch={() => {
              const errs = validateStep(3);
              if (errs.length > 0) { setStepErrors(errs); return; }
              setStepErrors([]);
              handleFullLaunch();
            }}
          />
        </>
      )}
    </EditorialPage>
  );
}

// ─── Nav Buttons ─────────────────────────────────────────────────────────────
function NavButtons({ step, setStep, onNext, isFirst, isLast }: { step: number; setStep: (n: number) => void; onNext?: () => void; isFirst: boolean; isLast: boolean }) {
  const current = STEPS.find((s) => s.num === step);
  return (
    <footer style={{ marginTop: 28, display: "flex", alignItems: "baseline", gap: 16, width: "100%" }}>
      {!isFirst && (
        <EditorialPillButton variant="outline" onClick={() => setStep(step - 1)} style={{ padding: "9px 24px" }}>
          ← Back
        </EditorialPillButton>
      )}
      <span style={{ fontSize: 13.5, color: "#8C8474", flex: isFirst ? 1 : undefined }}>
        Step {step} of 3 · {current?.label}
      </span>
      {!isLast && (
        <EditorialPillButton onClick={onNext ?? (() => setStep(step + 1))} style={{ marginLeft: "auto", padding: "10px 28px" }}>
          Next →
        </EditorialPillButton>
      )}
    </footer>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return <EditorialSectionHeader title={title} meta={sub} />;
}

function AdCreativePreviewCard({
  ad,
  isVideo,
  isSelected,
  formatLabel,
  selectable,
  onSelect,
}: {
  ad: { text: string };
  isVideo: boolean;
  isSelected: boolean;
  formatLabel: string;
  selectable: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!selectable}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "none",
        border: "none",
        padding: 0,
        cursor: selectable ? "pointer" : "default",
        textAlign: "left",
        minWidth: 0,
        width: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "4/5",
          border: isSelected ? "2px solid var(--red)" : "1px solid var(--border)",
          borderRadius: 12,
          padding: isSelected ? 4 : 5,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 8, overflow: "hidden", background: "var(--primary)" }}>
          {isVideo ? (
            <video src={ad.text} controls={false} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <img src={ad.text} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        {isSelected && (
          <div style={{
            position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: "50%",
            background: "var(--red)", color: "#FDF6E3", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800,
          }}>
            ✓
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, width: "100%" }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
          color: isSelected ? "var(--red)" : "var(--text-muted)",
        }}>
          {formatLabel}{isSelected ? " · selected" : ""}
        </div>
      </div>
    </button>
  );
}

function LaunchPanel({
  launchSuccess,
  launching,
  launchStep,
  launchError,
  hasLaunchedThisSegment,
  selectedId,
  selectedCampaignName,
  adSetName,
  existingAdSetId,
  onLaunch,
}: {
  launchSuccess: boolean;
  launching: boolean;
  launchStep: number;
  launchError: string;
  hasLaunchedThisSegment: boolean;
  selectedId: string | null | undefined;
  selectedCampaignName?: string;
  adSetName?: string;
  existingAdSetId?: string;
  onLaunch: () => void;
}) {
  const injectDescription = existingAdSetId
    ? `Ad will be added to ad set "${adSetName}" in ${selectedCampaignName}.`
    : "Add ads to an existing ad set or create a new one in the selected campaign.";

  if (launchSuccess) {
    return (
      <section style={{ marginTop: 48, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: "var(--green-light)",
            border: "1px solid var(--green)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "var(--green)", flexShrink: 0,
          }}>
            ✓
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--green-dark)" }}>
              Ads successfully launched
            </div>
            <div style={{ fontSize: 13.5, color: "#4A5A64", marginTop: 4 }}>
              Your campaign is now live on Meta Ads Manager.
            </div>
          </div>
          <a
            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 14,
              padding: "10px 24px",
              borderRadius: 999,
              background: "var(--primary)",
              color: "#FDF0D5",
              textDecoration: "none",
            }}
          >
            View in Meta ↗
          </a>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 48, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: "var(--primary-light)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
        }}>
          {selectedId ? "📥" : "🚀"}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--primary)" }}>
            {selectedId ? `Inject to: ${selectedCampaignName}` : "Launch campaign on Meta"}
          </div>
          <p style={{ fontSize: 13.5, color: "#8C8474", margin: "6px 0 0", lineHeight: 1.6 }}>
            {selectedId ? injectDescription : "Deploy your campaign, targeting, and ad creative directly to Meta Ads Manager."}
          </p>

          {launching && (
            <div style={{ padding: "16px 0", maxWidth: 420 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Spinner size={14} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1A4A66" }}>
                  {launchStep === 1 ? "Uploading media assets..." : launchStep === 2 ? "Compiling schema..." : launchStep === 3 ? "Building ad sets..." : "Finalising delivery..."}
                </span>
              </div>
              <div style={{ height: 4, background: "#E8DCC2", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--primary)", width: `${(launchStep / 4) * 100}%`, transition: "width 0.4s ease", borderRadius: 999 }} />
              </div>
            </div>
          )}

          {launchError && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#F9E3E0", borderRadius: 10, border: "1px solid #fecaca", color: "#780000", fontSize: 13, lineHeight: 1.6 }}>
              <strong>Error: </strong>{launchError}
            </div>
          )}
        </div>
        {!launching && (
          <EditorialPillButton
            variant={hasLaunchedThisSegment ? "primary" : "danger"}
            onClick={onLaunch}
            disabled={launching || hasLaunchedThisSegment}
            style={{
              padding: "10px 24px",
              ...(hasLaunchedThisSegment ? { background: "var(--green)", opacity: 0.85 } : {}),
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {hasLaunchedThisSegment ? "✓ Launched" : selectedId ? "Inject Ads →" : "Launch Ads on Facebook →"}
          </EditorialPillButton>
        )}
      </div>
    </section>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────
function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#8C8474", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ position: "relative", display: "inline-block", width: 40, height: 22, cursor: "pointer", flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 11, background: checked ? "#003049" : "#C2B79A", transition: "background 0.2s" }}>
        <div style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
    </label>
  );
}

// ─── Input Style ─────────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 9,
  border: "1.5px solid #E8DCC2",
  background: "#fff",
  fontSize: 13,
  fontWeight: 500,
  color: "#003049",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.15s",
  fontFamily: "inherit",
};

// ─── Placements Section ───────────────────────────────────────────────────────
const FB_POSITIONS = [
  { value: "feed", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "right_hand_column", label: "Right Column" },
  { value: "video_feeds", label: "Video Feeds" },
];
const IG_POSITIONS = [
  { value: "stream", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "explore", label: "Explore" },
];

function PlacementsSection({ config, setField }: { config: any; setField: (s: string, k: string, v: any) => void }) {
  const platforms: string[] = config.ad_set?.publisher_platforms || [];
  const fbPositions: string[] = config.ad_set?.facebook_positions || [];
  const igPositions: string[] = config.ad_set?.instagram_positions || [];
  const isFb = platforms.includes("facebook");
  const isIg = platforms.includes("instagram");

  const togglePlatform = (p: string) => {
    const next = platforms.includes(p) ? platforms.filter(x => x !== p) : [...platforms, p];
    if (next.length === 0) return;
    setField("ad_set", "publisher_platforms", next);
  };
  const togglePos = (key: string, pos: string, current: string[]) => {
    const next = current.includes(pos) ? current.filter(p => p !== pos) : [...current, pos];
    if (next.length === 0) return;
    setField("ad_set", key, next);
  };

  const platformPill = (on: boolean): React.CSSProperties => ({
    border: on ? "none" : "1px solid #C2B79A",
    borderRadius: 999,
    padding: "7px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    background: on ? "#003049" : "transparent",
    color: on ? "#FDF6E3" : "#8C8474",
  });

  const positionPill = (on: boolean): React.CSSProperties => ({
    border: `1px solid ${on ? "#003049" : "#C2B79A"}`,
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 13.5,
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    fontFamily: "inherit",
    background: "transparent",
    color: on ? "#003049" : "#8C8474",
  });

  return (
    <EditorialDefinitionList>
      <EditorialDefinitionRow label="Platform">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { id: "facebook", label: "Facebook" },
            { id: "instagram", label: "Instagram" },
          ].map(p => {
            const on = platforms.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => togglePlatform(p.id)} style={platformPill(on)}>
                {p.label}{on ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </EditorialDefinitionRow>
      {isFb && (
        <EditorialDefinitionRow label="Facebook positions" isLast={!isIg}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FB_POSITIONS.map(pos => {
              const on = fbPositions.includes(pos.value);
              return (
                <button key={pos.value} type="button" onClick={() => togglePos("facebook_positions", pos.value, fbPositions)} style={positionPill(on)}>
                  {on ? "✓ " : ""}{pos.label}
                </button>
              );
            })}
          </div>
        </EditorialDefinitionRow>
      )}
      {isIg && (
        <EditorialDefinitionRow label="Instagram positions" isLast>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {IG_POSITIONS.map(pos => {
              const on = igPositions.includes(pos.value);
              return (
                <button key={pos.value} type="button" onClick={() => togglePos("instagram_positions", pos.value, igPositions)} style={positionPill(on)}>
                  {on ? "✓ " : ""}{pos.label}
                </button>
              );
            })}
          </div>
        </EditorialDefinitionRow>
      )}
      {!isFb && !isIg && (
        <EditorialDefinitionRow label="Positions" isLast>
          <div style={{ fontSize: 13.5, color: "#8C8474" }}>Select at least one platform above.</div>
        </EditorialDefinitionRow>
      )}
    </EditorialDefinitionList>
  );
}

// ─── Ad Set Name Input (combobox when appending to existing campaign) ───────────
interface AdSetNameInputProps {
  adSets: any[];
  loading: boolean;
  name: string;
  existingId?: string;
  onChange: (name: string, existingId?: string) => void;
}

function AdSetNameInput({ adSets, loading, name, existingId, onChange }: AdSetNameInputProps) {
  const [inputValue, setInputValue] = useState(name);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => { setInputValue(name); }, [name]);

  const query = inputValue.trim().toLowerCase();
  const filtered = query
    ? adSets.filter(a => a.name.toLowerCase().includes(query))
    : adSets;
  const showCreateNew = query && !adSets.some(a => a.name.toLowerCase() === query);

  const handleInputChange = (v: string) => {
    setInputValue(v);
    const match = adSets.find(a => a.name.toLowerCase() === v.trim().toLowerCase());
    onChange(v, match?.id);
  };

  const handleSelect = (adSet: any) => {
    setInputValue(adSet.name);
    onChange(adSet.name, adSet.id);
    setShowDropdown(false);
  };

  const handleCreateNew = () => {
    onChange(inputValue.trim(), undefined);
    setShowDropdown(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Select existing ad set or type a new name..."
          style={{
            ...inputSt,
            paddingRight: loading ? 36 : 12,
            borderColor: existingId ? "#669BBC" : inputSt.border as string,
            background: existingId ? "#E7F0F6" : "#fff",
          }}
        />
        {loading && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
            <Spinner size={14} />
          </div>
        )}
      </div>
      {existingId && (
        <div style={{ fontSize: 11, color: "#003049", marginTop: 4, fontWeight: 600 }}>
          Existing ad set selected
        </div>
      )}
      {showDropdown && (filtered.length > 0 || showCreateNew) && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 50,
          background: "#fff", borderRadius: 10, border: "1.5px solid #E8DCC2",
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map(adSet => (
            <div
              key={adSet.id}
              onMouseDown={() => handleSelect(adSet)}
              style={{
                padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500,
                color: adSet.id === existingId ? "#1A4A66" : "#003049",
                background: adSet.id === existingId ? "#E7F0F6" : "transparent",
                borderBottom: "1px solid #FDF0D5",
              }}
            >
              <div>{adSet.name}</div>
              <div style={{ fontSize: 10, color: "#9FA8A3", fontFamily: "monospace", marginTop: 2 }}>{adSet.status} · ID: {adSet.id}</div>
            </div>
          ))}
          {showCreateNew && (
            <div
              onMouseDown={handleCreateNew}
              style={{
                padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                color: "#003049", background: "#FDF6E3",
              }}
            >
              + Create new ad set: &ldquo;{inputValue.trim()}&rdquo;
            </div>
          )}
          {!loading && adSets.length === 0 && !showCreateNew && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "#9FA8A3" }}>
              No ad sets found — type a name to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LocationSearch ───────────────────────────────────────────────────────────
interface LocationSearchProps { geoLocations: any; onChange: (v: any) => void; }

function LocationSearch({ geoLocations, onChange }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Build pills from countries, cities, and regions
  const selectedPills: any[] = [];
  if (geoLocations?.countries) {
    geoLocations.countries.forEach((c: any) => {
      const key = typeof c === "object" ? c.code : c;
      selectedPills.push({ key, name: key, type: "country" });
    });
  }
  if (geoLocations?.cities) {
    geoLocations.cities.forEach((c: any) => {
      selectedPills.push({ key: c.key, name: c.name, type: "city" });
    });
  }
  if (geoLocations?.regions) {
    geoLocations.regions.forEach((r: any) => {
      selectedPills.push({ key: r.key, name: r.name, type: "region" });
    });
  }

  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meta/locations?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data || []); setShowDropdown(true);
      } catch {} finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const handleSelect = (item: any) => {
    const newGeo = { ...geoLocations, location_types: geoLocations?.location_types || ["home", "recent"] };

    if (item.type === "country") {
      // Add country — remove any cities/regions in this country to avoid Meta overlap error
      const existing: string[] = newGeo.countries || [];
      if (!existing.includes(item.key)) {
        newGeo.countries = [...existing, item.key];
      }
      newGeo.cities = (newGeo.cities || []).filter((c: any) => c.country_code !== item.key);
      newGeo.regions = (newGeo.regions || []).filter((r: any) => r.country_code !== item.key);
      if (!newGeo.cities.length) delete newGeo.cities;
      if (!newGeo.regions.length) delete newGeo.regions;

    } else if (item.type === "city" || item.type === "neighborhood") {
      // Add city — remove parent country to avoid Meta overlap error
      const cityObj = { key: item.key, name: item.name, country_code: item.country_code };
      const existing = newGeo.cities || [];
      if (!existing.find((c: any) => c.key === item.key)) {
        newGeo.cities = [...existing, cityObj];
      }
      if (newGeo.countries) {
        newGeo.countries = newGeo.countries.filter((c: any) => c !== item.country_code);
        if (!newGeo.countries.length) delete newGeo.countries;
      }

    } else if (item.type === "region") {
      // Add region — remove parent country to avoid Meta overlap error
      const regionObj = { key: item.key, name: item.name, country_code: item.country_code };
      const existing = newGeo.regions || [];
      if (!existing.find((r: any) => r.key === item.key)) {
        newGeo.regions = [...existing, regionObj];
      }
      if (newGeo.countries) {
        newGeo.countries = newGeo.countries.filter((c: any) => c !== item.country_code);
        if (!newGeo.countries.length) delete newGeo.countries;
      }
    }

    onChange(newGeo); setQuery(""); setShowDropdown(false);
  };

  const handleRemove = (pill: any) => {
    const newGeo = { ...geoLocations };
    if (pill.type === "country") {
      newGeo.countries = (newGeo.countries || []).filter((c: any) => c !== pill.key);
      if (!newGeo.countries.length) delete newGeo.countries;
    } else if (pill.type === "city") {
      newGeo.cities = (newGeo.cities || []).filter((c: any) => c.key !== pill.key);
      if (!newGeo.cities.length) delete newGeo.cities;
    } else if (pill.type === "region") {
      newGeo.regions = (newGeo.regions || []).filter((r: any) => r.key !== pill.key);
      if (!newGeo.regions.length) delete newGeo.regions;
    }
    onChange(newGeo);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => results.length > 0 && setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Search countries, cities, regions..." style={{ ...inputSt, paddingRight: 36 }} />
        {loading && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><Spinner size={13} /></div>}
      </div>
      {showDropdown && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E8DCC2", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 320, overflowY: "auto" }}>
          {results.map((r: any) => (
            <div key={r.key} onMouseDown={e => { e.preventDefault(); handleSelect(r); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #FDF0D5", fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = "#FDF6E3"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontWeight: 600, color: "#003049" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#9FA8A3", marginTop: 1 }}>{r.type?.toUpperCase()} · {r.country_name || r.country_code}</div>
            </div>
          ))}
        </div>
      )}
      {selectedPills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {selectedPills.map((p: any) => (
            <div key={`${p.type}-${p.key}`} style={{ display: "flex", alignItems: "center", gap: 5, background: "#E7F0F6", color: "#1A4A66", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid #C2D6E2" }}>
              {p.type === "country" ? "🌐" : p.type === "city" ? "🏙️" : "🗺️"} {p.name}
              <button onClick={e => { e.preventDefault(); handleRemove(p); }} style={{ border: "none", background: "transparent", color: "#669BBC", cursor: "pointer", fontSize: 13, padding: 0, marginLeft: 2, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
