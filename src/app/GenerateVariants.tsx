"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Spinner,
  EditorialPage,
  EditorialPageHeader,
  EditorialSectionHeader,
  EditorialPillButton,
} from "./components";
import {
  CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT,
  VARIANT_GEN_AUTOMATION_ID_KEY,
} from "@/lib/client-dashboard-nav";

const VARIANT_ACTIVE_GENERATION_API = "/api/meta/automation/active-generation";

type ApprovedAd = {
  id: string | number;
  text: string;
  time: string;
  format: string;
  "json data"?: string | Record<string, unknown>;
};

type VariantRow = {
  id: string;
  mediaUrl: string;
  format: string;
  role: string;
  concept?: Record<string, unknown>;
};

type AutomationRecord = {
  id: string;
  status: string;
  numVariants: number;
  evalLengthDays: number;
  dailyBudgetCents: number;
  createdAt?: string;
  error?: string | null;
  variants: VariantRow[];
};

type GenerateVariantsProps = {
  approvedAds: ApprovedAd[];
  embed?: boolean;
  onBusyChange?: (payload: { active: boolean; progress: number; label: string }) => void;
  onContinueToCampaignSetup: (payload: {
    automationId: string;
    variants: VariantRow[];
    numVariants: number;
    evalLengthDays: number;
    dailyBudgetCents: number;
  }) => void;
};

function parseMetadata(ad: ApprovedAd) {
  const raw = ad["json data"];
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function adDisplayName(ad: ApprovedAd) {
  const meta = parseMetadata(ad);
  return (meta.ad_name as string) || (meta.headline as string) || "Untitled Ad";
}

function formatGenerationError(message: string) {
  if (/aborted due to timeout|timed out/i.test(message)) {
    return 'Generation timed out. Video variants can take 5–10 minutes — please try again. If this keeps happening, verify your API keys (OpenAI, kie.ai, ElevenLabs, AssemblyAI, Upload Post).';
  }
  return message;
}

const metricInputWidth = {
  sm: 72,
  md: 96,
} as const;

function sanitizeIntegerInput(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

const cardCaptionTitleStyle: CSSProperties = {
  fontSize: 13.5,
  fontWeight: 700,
  color: "var(--primary)",
  marginTop: 2,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function GenerateVariants({
  approvedAds,
  embed = false,
  onBusyChange,
  onContinueToCampaignSetup,
}: GenerateVariantsProps) {
  const [defaults, setDefaults] = useState({
    numVariants: 3,
    evalLengthDays: 7,
    dailyBudgetCents: 100,
  });
  const [numVariants, setNumVariants] = useState(3);
  const [evalLengthDays, setEvalLengthDays] = useState(7);
  const [dailyBudgetCents, setDailyBudgetCents] = useState(100);
  const [numVariantsDraft, setNumVariantsDraft] = useState<string | null>(null);
  const [evalLengthDaysDraft, setEvalLengthDaysDraft] = useState<string | null>(null);
  const [dailyBudgetDraft, setDailyBudgetDraft] = useState<string | null>(null);
  const [selectedBaseAd, setSelectedBaseAd] = useState<ApprovedAd | null>(null);
  const [automation, setAutomation] = useState<AutomationRecord | null>(null);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [challengerStartedAt, setChallengerStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [challengerElapsedSec, setChallengerElapsedSec] = useState(0);
  const [error, setError] = useState("");
  const resumeCheckedRef = useRef(false);
  const numVariantsRestoreRef = useRef(3);
  const evalLengthDaysRestoreRef = useRef(7);
  const dailyBudgetRestoreRef = useRef(100);

  const restoreBaseAdSelection = useCallback(
    (record: AutomationRecord) => {
      const base = record.variants.find((v) => v.role === "base");
      if (!base) return;
      const match = approvedAds.find((ad) => ad.text === base.mediaUrl);
      if (match) setSelectedBaseAd(match);
    },
    [approvedAds]
  );

  const applyAutomationState = useCallback((record: AutomationRecord) => {
    setAutomation(record);
    setNumVariants(record.numVariants);
    setEvalLengthDays(record.evalLengthDays);
    setDailyBudgetCents(record.dailyBudgetCents);
  }, []);

  const fetchDefaults = useCallback(async () => {
    setLoadingDefaults(true);
    try {
      const res = await fetch("/api/meta/automation/defaults");
      const data = await res.json();
      if (res.ok && data.defaults) {
        setDefaults(data.defaults);
        setNumVariants(data.defaults.numVariants);
        setEvalLengthDays(data.defaults.evalLengthDays);
        setDailyBudgetCents(data.defaults.dailyBudgetCents);
      }
    } catch {
      /* keep local defaults */
    } finally {
      setLoadingDefaults(false);
    }
  }, []);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  useEffect(() => {
    if (!generating || !generationStartedAt) {
      setElapsedSec(0);
      setChallengerElapsedSec(0);
      return;
    }
    const tick = () => {
      const now = Date.now();
      setElapsedSec(Math.floor((now - generationStartedAt) / 1000));
      if (challengerStartedAt) {
        setChallengerElapsedSec(Math.floor((now - challengerStartedAt) / 1000));
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [generating, generationStartedAt, challengerStartedAt]);

  const pollAutomation = useCallback(async (automationId: string) => {
    const res = await fetch(`/api/meta/automation/${automationId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to poll automation");
    return data.automation as AutomationRecord;
  }, []);

  useEffect(() => {
    if (resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;

    void (async () => {
      try {
        const storedId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(VARIANT_GEN_AUTOMATION_ID_KEY)
            : null;

        if (storedId) {
          const res = await fetch(`/api/meta/automation/${encodeURIComponent(storedId)}`);
          const data = await res.json();
          if (res.ok && data.automation?.status === "generating") {
            applyAutomationState(data.automation as AutomationRecord);
            restoreBaseAdSelection(data.automation as AutomationRecord);
            setGenerating(true);
            const startedAt = data.automation.createdAt
              ? new Date(data.automation.createdAt).getTime()
              : Date.now();
            setGenerationStartedAt(startedAt);
            setChallengerStartedAt(startedAt);
            return;
          }
          window.localStorage.removeItem(VARIANT_GEN_AUTOMATION_ID_KEY);
        }

        const activeRes = await fetch(VARIANT_ACTIVE_GENERATION_API);
        const activeData = await activeRes.json();
        if (!activeRes.ok || !activeData.automation) return;

        const inProgress = activeData.automation as AutomationRecord;
        window.localStorage.setItem(VARIANT_GEN_AUTOMATION_ID_KEY, inProgress.id);
        applyAutomationState(inProgress);
        restoreBaseAdSelection(inProgress);
        setGenerating(true);
        const startedAt = inProgress.createdAt
          ? new Date(inProgress.createdAt).getTime()
          : Date.now();
        setGenerationStartedAt(startedAt);
        setChallengerStartedAt(startedAt);
      } catch {
        /* ignore resume errors */
      }
    })();
  }, [applyAutomationState, restoreBaseAdSelection]);

  useEffect(() => {
    if (!automation || selectedBaseAd) return;
    restoreBaseAdSelection(automation);
  }, [automation, restoreBaseAdSelection, selectedBaseAd]);

  useEffect(() => {
    if (!generating || !automation?.id) return;

    let cancelled = false;

    void (async () => {
      while (!cancelled) {
        try {
          const current = await pollAutomation(automation.id);
          if (cancelled) return;

          applyAutomationState(current);
          restoreBaseAdSelection(current);

          if (current.status === "pending_review") {
            setGenerating(false);
            setGenerationStartedAt(null);
            setChallengerStartedAt(null);
            window.localStorage.removeItem(VARIANT_GEN_AUTOMATION_ID_KEY);
            return;
          }

          if (current.status === "error") {
            setGenerating(false);
            setGenerationStartedAt(null);
            setChallengerStartedAt(null);
            window.localStorage.removeItem(VARIANT_GEN_AUTOMATION_ID_KEY);
            setError(formatGenerationError(current.error || "Variant generation failed"));
            return;
          }

          if (current.status !== "generating") {
            setGenerating(false);
            setGenerationStartedAt(null);
            setChallengerStartedAt(null);
            window.localStorage.removeItem(VARIANT_GEN_AUTOMATION_ID_KEY);
            return;
          }
        } catch (err: unknown) {
          if (cancelled) return;
          setGenerating(false);
          setGenerationStartedAt(null);
          setChallengerStartedAt(null);
          setError(formatGenerationError(err instanceof Error ? err.message : "Failed to poll automation"));
          return;
        }

        await new Promise((r) => setTimeout(r, 3000));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    generating,
    automation?.id,
    pollAutomation,
    applyAutomationState,
    restoreBaseAdSelection,
  ]);

  const handleGenerate = async () => {
    if (!selectedBaseAd) {
      setError("Select a base approved ad first.");
      return;
    }
    if (generating) return;

    setGenerating(true);
    setGenerationStartedAt(Date.now());
    setChallengerStartedAt(Date.now());
    setError("");
    setAutomation(null);

    try {
      const res = await fetch("/api/meta/automation/generate-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseAdId: selectedBaseAd.id,
          baseAdText: selectedBaseAd.text,
          numVariants,
          evalLengthDays,
          dailyBudgetCents,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.automation) {
        applyAutomationState(data.automation as AutomationRecord);
        window.localStorage.setItem(VARIANT_GEN_AUTOMATION_ID_KEY, data.automation.id);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to start generation");

      applyAutomationState(data.automation as AutomationRecord);
      window.localStorage.setItem(VARIANT_GEN_AUTOMATION_ID_KEY, data.automation.id);
    } catch (err: unknown) {
      setError(formatGenerationError(err instanceof Error ? err.message : "Generation failed"));
      setGenerating(false);
      setGenerationStartedAt(null);
      setChallengerStartedAt(null);
      window.localStorage.removeItem(VARIANT_GEN_AUTOMATION_ID_KEY);
    }
  };

  const currentGenerationVariants = automation
    ? automation.variants.filter((v) => v.role === "base" || v.role === "challenger")
    : [];

  const challengersNeeded = Math.max(0, numVariants - 1);
  const challengersDone = currentGenerationVariants.filter((v) => v.role === "challenger").length;

  useEffect(() => {
    if (challengersDone > 0) {
      setChallengerStartedAt(Date.now());
      setChallengerElapsedSec(0);
    }
  }, [challengersDone]);

  const baseReady =
    Boolean(currentGenerationVariants.find((v) => v.role === "base")) ||
    (generating && Boolean(selectedBaseAd));
  const completedCount = challengersDone + (baseReady ? 1 : 0);
  const isVideoBase = (selectedBaseAd?.format || "").toLowerCase() === "video";
  const isInProgress = generating || automation?.status === "generating";
  const slotPercent = 100 / numVariants;
  const finishedPercent = (completedCount / numVariants) * 100;
  const estimatedSecPerChallenger = isVideoBase ? 420 : 90;
  const hasActiveChallenger = isInProgress && challengersDone < challengersNeeded;
  const inSlotPercent = hasActiveChallenger
    ? slotPercent * Math.min(0.92, challengerElapsedSec / estimatedSecPerChallenger)
    : 0;
  const progressPercent = Math.min(
    hasActiveChallenger ? 99 : 100,
    Math.round(finishedPercent + inSlotPercent)
  );

  const progressLabel = useMemo(() => {
    if (completedCount >= numVariants) return "All variants ready";
    if (challengersDone === 0) {
      return challengersNeeded === 0
        ? "Preparing variant set..."
        : `Generating AI variant 1 of ${challengersNeeded}${
            isVideoBase ? " — video variants may take several minutes" : ""
          }`;
    }
    const next = challengersDone + 1;
    return `Generating AI variant ${next} of ${challengersNeeded} (${completedCount} of ${numVariants} ready)`;
  }, [
    challengersDone,
    challengersNeeded,
    completedCount,
    isVideoBase,
    numVariants,
  ]);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const summaryLine = `${numVariants} variant${numVariants === 1 ? "" : "s"} · ${evalLengthDays}-day evaluation · $${(dailyBudgetCents / 100).toFixed(2)}/day per ad`;

  useEffect(() => {
    const active = isInProgress;
    onBusyChange?.({
      active,
      progress: active ? progressPercent : 0,
      label: active ? progressLabel : "",
    });

    if (!embed || typeof window === "undefined" || window.parent === window) return;
    window.parent.postMessage(
      { type: CLIENT_DASHBOARD_CREATE_AD_GEN_EVENT, active },
      window.location.origin
    );
  }, [embed, isInProgress, onBusyChange, progressLabel, progressPercent]);

  return (
    <EditorialPage>
      <EditorialPageHeader
        eyebrow="Meta Ads"
        title="Generate Ad Variants"
        subtitle="One-time setup: pick an approved ad as the base and generate your first variant set. Launch them in Campaign Setup, then use Automated Campaigns for ongoing evaluation and new variants."
      />

      {/* Variant Settings */}
      <section>
        <EditorialSectionHeader title="Variant Settings" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ padding: "24px 24px 24px 0", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              Number of variants
            </div>
            <input
              type="text"
              inputMode="numeric"
              className="editorial-metric-input"
              value={numVariantsDraft ?? String(numVariants)}
              onFocus={() => {
                numVariantsRestoreRef.current = numVariants;
                setNumVariantsDraft(String(numVariants));
              }}
              onChange={(e) => setNumVariantsDraft(sanitizeIntegerInput(e.target.value))}
              onBlur={() => {
                const raw = numVariantsDraft ?? "";
                if (raw === "") {
                  setNumVariants(numVariantsRestoreRef.current);
                } else {
                  setNumVariants(
                    Math.min(10, Math.max(2, Number(raw) || numVariantsRestoreRef.current))
                  );
                }
                setNumVariantsDraft(null);
              }}
              style={{ width: metricInputWidth.sm }}
            />
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>
              Base ad counts as variant #1 — generates {challengersNeeded} new variant{challengersNeeded === 1 ? "" : "s"}.
            </div>
          </div>

          <div style={{ padding: 24, borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              Evaluation length (days)
            </div>
            <input
              type="text"
              inputMode="numeric"
              className="editorial-metric-input"
              value={evalLengthDaysDraft ?? String(evalLengthDays)}
              onFocus={() => {
                evalLengthDaysRestoreRef.current = evalLengthDays;
                setEvalLengthDaysDraft(String(evalLengthDays));
              }}
              onChange={(e) => setEvalLengthDaysDraft(sanitizeIntegerInput(e.target.value))}
              onBlur={() => {
                const raw = evalLengthDaysDraft ?? "";
                if (raw === "") {
                  setEvalLengthDays(evalLengthDaysRestoreRef.current);
                } else {
                  setEvalLengthDays(
                    Math.min(30, Math.max(1, Number(raw) || evalLengthDaysRestoreRef.current))
                  );
                }
                setEvalLengthDaysDraft(null);
              }}
              style={{ width: metricInputWidth.sm }}
            />
          </div>

          <div style={{ padding: "24px 0 24px 24px" }}>
            <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              Amount per day (USD)
            </div>
            <input
              type="text"
              inputMode="decimal"
              className="editorial-metric-input"
              value={dailyBudgetDraft ?? (dailyBudgetCents / 100).toFixed(2)}
              onFocus={() => {
                dailyBudgetRestoreRef.current = dailyBudgetCents;
                setDailyBudgetDraft((dailyBudgetCents / 100).toFixed(2));
              }}
              onChange={(e) => setDailyBudgetDraft(sanitizeDecimalInput(e.target.value))}
              onBlur={() => {
                const raw = dailyBudgetDraft ?? "";
                if (raw === "" || raw === ".") {
                  setDailyBudgetCents(dailyBudgetRestoreRef.current);
                } else {
                  const parsed = Number(raw);
                  setDailyBudgetCents(
                    Math.max(
                      100,
                      Math.round(
                        (Number.isNaN(parsed)
                          ? dailyBudgetRestoreRef.current / 100
                          : parsed) * 100
                      )
                    )
                  );
                }
                setDailyBudgetDraft(null);
              }}
              style={{ width: metricInputWidth.md }}
            />
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>
              Default Meta minimum is $1.00/day per ad.
            </div>
          </div>
        </div>
      </section>

      {/* Base ad selection */}
      <section style={{ marginTop: 48 }}>
        <EditorialSectionHeader
          title="Select Base Approved Ad"
          meta={
            approvedAds.length === 0
              ? undefined
              : `${approvedAds.length} approved ad${approvedAds.length === 1 ? "" : "s"}`
          }
        />

        {approvedAds.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, paddingTop: 24 }}>
            No approved ads yet. Approve an ad in the Approval tab first.
          </div>
        ) : (
          <div
            className="editorial-preview-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 28,
              paddingTop: 24,
            }}
          >
            {approvedAds.map((ad, idx) => {
              const isVideo = (ad.format || "").toLowerCase() === "video";
              const selected = selectedBaseAd?.text === ad.text;
              const name = adDisplayName(ad);
              const formatLabel = isVideo ? "Video" : "Image";

              return (
                <button
                  key={`${ad.id}-${idx}`}
                  type="button"
                  onClick={() => setSelectedBaseAd(ad)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: 0,
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "4/5",
                      border: selected ? "2px solid var(--red)" : "1px solid var(--border)",
                      borderRadius: 12,
                      padding: selected ? 4 : 5,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: "100%", height: "100%", borderRadius: 8, overflow: "hidden", background: "var(--primary)" }}>
                      {isVideo ? (
                        <video src={ad.text} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} muted playsInline />
                      ) : (
                        <img src={ad.text} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      )}
                    </div>
                  </div>
                  <div style={{ minWidth: 0, width: "100%" }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: selected ? "var(--red)" : "var(--text-muted)",
                      }}
                    >
                      {formatLabel}{selected ? " · selected" : ""}
                    </div>
                    <div style={cardCaptionTitleStyle} title={name}>
                      {name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#F9E3E0",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: 12,
              marginTop: 24,
              color: "#780000",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <footer
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{summaryLine}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {automation?.status === "pending_review" && currentGenerationVariants.length > 0 && (
              <EditorialPillButton
                variant="outline"
                onClick={() =>
                  onContinueToCampaignSetup({
                    automationId: automation.id,
                    variants: currentGenerationVariants,
                    numVariants,
                    evalLengthDays,
                    dailyBudgetCents,
                  })
                }
              >
                Continue to Campaign Setup →
              </EditorialPillButton>
            )}
            <EditorialPillButton
              variant="danger"
              onClick={handleGenerate}
              disabled={generating || !selectedBaseAd || loadingDefaults}
              style={{ marginLeft: automation?.status === "pending_review" ? 0 : undefined, padding: "10px 24px", whiteSpace: "nowrap" }}
            >
              {generating ? "Generating variants…" : "Generate variants →"}
            </EditorialPillButton>
          </div>
        </footer>
      </section>

      {/* Generation progress */}
      {isInProgress && (
        <section style={{ marginTop: 48 }}>
          <EditorialSectionHeader title="Generating Variants" />
          <div style={{ paddingTop: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Spinner />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{progressLabel}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {completedCount} of {numVariants} variants ready
                  </div>
                </div>
              </div>
              {elapsedSec > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                  Elapsed {formatElapsed(elapsedSec)}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end", fontSize: 11, color: "var(--text-muted)" }}>
              <span>{progressPercent}%</span>
            </div>

            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "var(--border)",
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(progressPercent, completedCount > 0 ? 8 : 4)}%`,
                  borderRadius: 999,
                  background: "var(--primary)",
                  transition: hasActiveChallenger ? "width 1s linear" : "width 0.6s ease",
                }}
              />
            </div>

            <div
              className="editorial-preview-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 28,
              }}
            >
              {Array.from({ length: numVariants }).map((_, slotIndex) => {
                const isBaseSlot = slotIndex === 0;
                const baseVariant = currentGenerationVariants.find((v) => v.role === "base");
                const challengers = currentGenerationVariants.filter((v) => v.role === "challenger");

                if (isBaseSlot) {
                  if (baseVariant) {
                    return (
                      <VariantPreviewCard
                        key={baseVariant.id}
                        variant={baseVariant}
                        label="Base variant"
                        status="done"
                      />
                    );
                  }
                  if (generating && selectedBaseAd) {
                    const isVideo = (selectedBaseAd.format || "").toLowerCase() === "video";
                    return (
                      <VariantPreviewCard
                        key="selected-base"
                        variant={{
                          id: "selected-base",
                          mediaUrl: selectedBaseAd.text,
                          format: isVideo ? "Video" : "Image",
                          role: "base",
                        }}
                        label="Base variant"
                        status="done"
                      />
                    );
                  }
                }

                const challenger = challengers[slotIndex - 1];
                if (challenger) {
                  return (
                    <VariantPreviewCard
                      key={challenger.id}
                      variant={challenger}
                      label={`AI variant ${slotIndex}`}
                      status="done"
                    />
                  );
                }

                const pendingLabel = isBaseSlot ? "Base variant" : `AI variant ${slotIndex}`;

                return (
                  <VariantPreviewCard
                    key={`pending-${slotIndex}`}
                    label={pendingLabel}
                    status={slotIndex === completedCount ? "active" : "pending"}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Completed variant set */}
      {automation?.status === "pending_review" && currentGenerationVariants.length > 0 && !isInProgress && (
        <section style={{ marginTop: 48 }}>
          <EditorialSectionHeader
            title="Variant Set"
            meta={`${currentGenerationVariants.length}/${numVariants}`}
          />
          <div
            className="editorial-preview-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 28,
              paddingTop: 24,
            }}
          >
            {currentGenerationVariants.map((variant, idx) => (
              <VariantPreviewCard
                key={variant.id}
                variant={variant}
                label={variant.role === "base" ? "Base variant" : `AI variant ${idx}`}
                status="done"
              />
            ))}
          </div>
        </section>
      )}

      <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.3</div>
    </EditorialPage>
  );
}

function VariantPreviewCard({
  variant,
  label,
  status,
}: {
  variant?: VariantRow;
  label: string;
  status: "done" | "active" | "pending";
}) {
  const isVideo = variant?.format === "Video";
  const formatLabel = isVideo ? "Video" : "Image";
  const statusLabel =
    status === "done"
      ? label
      : status === "active"
        ? `${formatLabel} · generating`
        : `${formatLabel} · queued`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, width: "100%" }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "4/5",
          border:
            status === "active"
              ? "2px solid var(--red)"
              : status === "done"
                ? "1px solid var(--border)"
                : "1px dashed var(--border)",
          borderRadius: 12,
          padding: status === "active" ? 4 : 5,
          overflow: "hidden",
          opacity: status === "pending" ? 0.65 : 1,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--primary)",
            position: "relative",
          }}
        >
          {variant ? (
            isVideo ? (
              <video
                src={variant.mediaUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                muted
                playsInline
              />
            ) : (
              <img
                src={variant.mediaUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            )
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: status === "active" ? "#23394A" : "#23394A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {status === "active" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <Spinner />
                  <span style={{ fontSize: 10, color: "#9FA8A3" }}>Generating…</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ minWidth: 0, width: "100%" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: status === "active" ? "var(--red)" : status === "done" ? "var(--text-muted)" : "var(--text-muted)",
          }}
        >
          {statusLabel}
        </div>
        {variant && (
          <div style={cardCaptionTitleStyle} title={label}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
