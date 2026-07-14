"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Card, Badge, SectionTitle, Spinner } from "./components";

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

function formatGenerationError(message: string) {
  if (/aborted due to timeout|timed out/i.test(message)) {
    return 'Generation timed out. Video variants can take 5–10 minutes — please try again. If this keeps happening, verify your API keys (OpenAI, kie.ai, ElevenLabs, AssemblyAI, Upload Post).';
  }
  return message;
}

export default function GenerateVariants({
  approvedAds,
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
        const res = await fetch("/api/meta/automation");
        const data = await res.json();
        if (!res.ok) return;

        const automations = (data.automations || []) as AutomationRecord[];
        const inProgress = automations.find((a) => a.status === "generating");
        if (!inProgress) return;

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
            return;
          }

          if (current.status === "error") {
            setGenerating(false);
            setGenerationStartedAt(null);
            setChallengerStartedAt(null);
            setError(formatGenerationError(current.error || "Variant generation failed"));
            return;
          }

          if (current.status !== "generating") {
            setGenerating(false);
            setGenerationStartedAt(null);
            setChallengerStartedAt(null);
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
      if (!res.ok) throw new Error(data.error || "Failed to start generation");

      applyAutomationState(data.automation as AutomationRecord);
    } catch (err: unknown) {
      setError(formatGenerationError(err instanceof Error ? err.message : "Generation failed"));
      setGenerating(false);
      setGenerationStartedAt(null);
      setChallengerStartedAt(null);
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

  // Base ad is already approved — it is copied, not generated. Count it as ready from the start.
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

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>Generate Ad Variants</SectionTitle>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8, lineHeight: 1.6 }}>
          One-time setup: pick an approved ad as the base and generate your first variant set.
          Launch them in Campaign Setup, then use Automated Campaigns for ongoing evaluation and new variants.
        </div>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            Number of variants
            <input
              type="number"
              min={2}
              max={10}
              value={numVariants}
              onChange={(e) => setNumVariants(Math.max(2, Number(e.target.value) || 2))}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              Base ad counts as variant #1. Generates {challengersNeeded} new variant{challengersNeeded === 1 ? "" : "s"}.
            </span>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            Evaluation length (days)
            <input
              type="number"
              min={1}
              max={30}
              value={evalLengthDays}
              onChange={(e) => setEvalLengthDays(Math.max(1, Number(e.target.value) || 1))}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            Amount per day (USD)
            <input
              type="number"
              min={1}
              step={0.01}
              value={(dailyBudgetCents / 100).toFixed(2)}
              onChange={(e) =>
                setDailyBudgetCents(Math.max(100, Math.round((Number(e.target.value) || 1) * 100)))
              }
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
              Default Meta minimum is $1.00/day per ad.
            </span>
          </label>
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Select base approved ad</div>
        {approvedAds.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            No approved ads yet. Approve an ad in the Approval tab first.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            {approvedAds.map((ad, idx) => {
              const isVideo = (ad.format || "").toLowerCase() === "video";
              const selected = selectedBaseAd?.text === ad.text;
              const meta = parseMetadata(ad);
              return (
                <button
                  key={`${ad.id}-${idx}`}
                  type="button"
                  onClick={() => setSelectedBaseAd(ad)}
                  style={{
                    border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    background: "var(--card-bg)",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ aspectRatio: "9/16", background: "#0f172a" }}>
                    {isVideo ? (
                      <video src={ad.text} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <img src={ad.text} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                  </div>
                  <div style={{ padding: 8 }}>
                    <Badge
                      text={isVideo ? "Video" : "Image"}
                      color={isVideo ? "var(--primary)" : "var(--text-muted)"}
                      bg={isVideo ? "var(--primary-light)" : "var(--surface)"}
                    />
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {(meta.ad_name as string) || (meta.headline as string) || "Approved ad"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius-md)",
            padding: 12,
            marginBottom: 16,
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !selectedBaseAd || loadingDefaults}
          style={primaryBtn}
        >
          {generating ? "Generating variants..." : "Generate variants"}
        </button>

        {automation?.status === "pending_review" && currentGenerationVariants.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onContinueToCampaignSetup({
                automationId: automation.id,
                variants: currentGenerationVariants,
                numVariants,
                evalLengthDays,
                dailyBudgetCents,
              })
            }
            style={secondaryBtn}
          >
            Continue to Campaign Setup →
          </button>
        )}
      </div>

      {isInProgress && (
        <Card style={{ marginBottom: 20, border: "1px solid var(--primary-light)", background: "var(--primary-light)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Spinner />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Generating variants</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{progressLabel}</div>
              </div>
            </div>
            {elapsedSec > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                Elapsed {formatElapsed(elapsedSec)}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
            <span>{completedCount} of {numVariants} variants ready</span>
            <span>{progressPercent}%</span>
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.7)",
              border: "1px solid var(--border-light)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.max(progressPercent, completedCount > 0 ? 8 : 4)}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, var(--primary), #60a5fa)",
                transition: hasActiveChallenger ? "width 1s linear" : "width 0.6s ease",
                boxShadow: progressPercent < 100 ? "0 0 8px rgba(59,130,246,0.35)" : "none",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
              marginTop: 16,
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
        </Card>
      )}

      {automation?.status === "pending_review" && currentGenerationVariants.length > 0 && !isInProgress && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Variant set ({currentGenerationVariants.length}/{numVariants})
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
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
        </Card>
      )}
    </div>
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

  return (
    <div
      style={{
        border:
          status === "active"
            ? "2px solid var(--primary)"
            : status === "done"
              ? "1px solid var(--border)"
              : "1px dashed var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        opacity: status === "pending" ? 0.65 : 1,
      }}
    >
      <div style={{ aspectRatio: "9/16", background: "#0f172a", position: "relative" }}>
        {variant ? (
          isVideo ? (
            <video
              src={variant.mediaUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <img
              src={variant.mediaUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                status === "active"
                  ? "linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)"
                  : "#1e293b",
              backgroundSize: status === "active" ? "200% 200%" : undefined,
              animation: status === "active" ? "shimmer 2s ease infinite" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {status === "active" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Spinner />
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Generating...</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: 8 }}>
        <Badge
          text={
            status === "done"
              ? label
              : status === "active"
                ? `${label} · in progress`
                : `${label} · queued`
          }
          color={
            status === "done"
              ? variant?.role === "base"
                ? "var(--green)"
                : "var(--primary)"
              : status === "active"
                ? "var(--primary)"
                : "var(--text-muted)"
          }
          bg={
            status === "done"
              ? variant?.role === "base"
                ? "var(--green-light)"
                : "var(--primary-light)"
              : status === "active"
                ? "var(--primary-light)"
                : "var(--surface)"
          }
        />
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border)",
  background: "var(--input-bg, #fff)",
  fontSize: 14,
};

const primaryBtn: CSSProperties = {
  padding: "12px 20px",
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--primary)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  padding: "12px 20px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--primary)",
  background: "#eff6ff",
  color: "var(--primary)",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
