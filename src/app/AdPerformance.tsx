"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Spinner,
  EditorialPage,
  EditorialPageHeader,
  EditorialDefinitionRow,
  EditorialPillButton,
  EditorialTextLink,
} from "./components";

type VariantMetrics = {
  spend?: string;
  clicks?: string;
  cpc?: string;
  ctr?: string;
};

type VariantRow = {
  id: string;
  generation: number;
  mediaUrl: string;
  format: string;
  role: string;
  metaAdId?: string | null;
  metrics?: VariantMetrics | null;
  createdAt?: string;
};

type AutomationRow = {
  id: string;
  status: string;
  generation: number;
  numVariants: number;
  evalLengthDays: number;
  dailyBudgetCents: number;
  automationEnabled: boolean;
  metaCampaignId?: string | null;
  metaAdSetId?: string | null;
  nextEvaluationAt?: string | null;
  error?: string | null;
  variants: VariantRow[];
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatMetricMoney(val?: string) {
  return `$${parseFloat(val || "0").toFixed(2)}`;
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

const ACTIVE_STATUSES = new Set(["evaluating", "generating"]);
const DELETABLE_STATUSES = new Set(["pending_review", "generating", "error"]);

function loopStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function loopStatusColor(status: string) {
  if (status === "pending_review") return "#C1121F";
  if (status === "running") return "#38678A";
  if (status === "error") return "#C1121F";
  return "#8C8474";
}

export default function AdPerformance() {
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<VariantRow | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{
    automationId: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch("/api/meta/automation");
      const data = await res.json();
      if (res.ok) {
        setAutomations(data.automations || []);
        setError("");
      } else {
        setError(data.error || "Failed to load automations");
      }
    } catch {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const hasActiveJob = automations.some((a) => ACTIVE_STATUSES.has(a.status));

  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = setInterval(fetchAutomations, 5000);
    return () => clearInterval(timer);
  }, [hasActiveJob, fetchAutomations]);

  const toggleAutoLaunch = async (automationId: string, enabled: boolean) => {
    setActionId(automationId);
    try {
      await fetch(`/api/meta/automation/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationEnabled: enabled }),
      });
      await fetchAutomations();
    } finally {
      setActionId(null);
    }
  };

  const runEvaluation = async (automationId: string) => {
    setActionId(automationId);
    setError("");
    try {
      const res = await fetch(`/api/meta/automation/${automationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");
      await fetchAutomations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setActionId(null);
    }
  };

  const launchReviewedVariants = async (automation: AutomationRow) => {
    setLaunchingId(automation.id);
    setActionId(automation.id);
    setError("");
    setFeedback(null);
    try {
      const res = await fetch(`/api/meta/automation/${automation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "launch",
          generation: automation.generation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Launch failed");
      setFeedback({
        automationId: automation.id,
        type: "success",
        message: `Launched ${data.launched?.adIds?.length || automation.numVariants} ads to Meta. The loop is now running.`,
      });
      await fetchAutomations();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Launch failed";
      setError(message);
      setFeedback({
        automationId: automation.id,
        type: "error",
        message,
      });
    } finally {
      setLaunchingId(null);
      setActionId(null);
    }
  };

  const rejectVariant = async (automation: AutomationRow, variant: VariantRow) => {
    if (
      !window.confirm(
        "Reject this variant and generate a replacement? The current ad will be removed."
      )
    ) {
      return;
    }

    setRejectingId(variant.id);
    setError("");
    try {
      const res = await fetch(`/api/meta/automation/${automation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_variant",
          variantId: variant.id,
          generation: automation.generation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      await fetchAutomations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setRejectingId(null);
    }
  };

  const deleteAutomation = async (automation: AutomationRow) => {
    const label = automation.metaAdSetId
      ? `ad set ${automation.metaAdSetId}`
      : "this automation loop";
    if (
      !window.confirm(
        `Delete ${label}? This removes the loop from the dashboard only — any ads already on Meta are not affected.`
      )
    ) {
      return;
    }

    setActionId(automation.id);
    setError("");
    try {
      const res = await fetch(`/api/meta/automation/${automation.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await fetchAutomations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionId(null);
    }
  };

  return (
    <EditorialPage>
      <EditorialPageHeader
        eyebrow="Meta Ads"
        title="Automated Campaigns"
        subtitle="Evaluates your running ad sets, picks the best performer, archives losers, and generates new variants. Toggle auto-launch, or review each set before it ships to Meta."
        actions={
          <EditorialTextLink onClick={fetchAutomations} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </EditorialTextLink>
        }
        style={{ marginBottom: 36 }}
      />

      {error && (
        <div
          style={{
            padding: "14px 0",
            marginBottom: 24,
            borderBottom: "1px solid var(--red)",
            color: "var(--red)",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {loading && automations.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "48px 0" }}>
          <Spinner />
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading automations…</span>
        </div>
      ) : automations.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#4A5A64", maxWidth: 640 }}>
          No automated campaigns yet. Use <strong>Generate Ad Variants</strong> to create your first
          variant set, launch it in <strong>Campaign Setup</strong>, then return here to manage the
          evaluation loop.
        </p>
      ) : (
        automations.map((automation, loopIndex) => (
          <AutomationLoopSection
            key={automation.id}
            automation={automation}
            loopNumber={loopIndex + 1}
            busy={
              actionId === automation.id ||
              launchingId === automation.id ||
              ACTIVE_STATUSES.has(automation.status)
            }
            launching={launchingId === automation.id}
            rejectingId={rejectingId}
            feedback={feedback?.automationId === automation.id ? feedback : null}
            onToggleAutoLaunch={toggleAutoLaunch}
            onRunEvaluation={runEvaluation}
            onLaunch={launchReviewedVariants}
            onDelete={deleteAutomation}
            onReject={rejectVariant}
            onOpenPreview={setPreview}
            isFirst={loopIndex === 0}
          />
        ))
      )}

      {preview && <VariantPreviewOverlay variant={preview} onClose={() => setPreview(null)} />}

      <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.2</div>
    </EditorialPage>
  );
}

function AutomationLoopSection({
  automation,
  loopNumber,
  busy,
  launching,
  rejectingId,
  feedback,
  onToggleAutoLaunch,
  onRunEvaluation,
  onLaunch,
  onDelete,
  onReject,
  onOpenPreview,
  isFirst,
}: {
  automation: AutomationRow;
  loopNumber: number;
  busy: boolean;
  launching: boolean;
  rejectingId: string | null;
  feedback: { type: "success" | "error"; message: string } | null;
  onToggleAutoLaunch: (id: string, enabled: boolean) => void;
  onRunEvaluation: (id: string) => void;
  onLaunch: (automation: AutomationRow) => void;
  onDelete: (automation: AutomationRow) => void;
  onReject: (automation: AutomationRow, variant: VariantRow) => void;
  onOpenPreview: (variant: VariantRow) => void;
  isFirst: boolean;
}) {
  const currentVariants = automation.variants.filter((v) => v.generation === automation.generation);
  const archived = automation.variants.filter((v) => v.role === "archived");
  const canEvaluate = automation.status === "running" && Boolean(automation.metaAdSetId);
  const canLaunch = automation.status === "pending_review" && currentVariants.length > 0;
  const canDelete = DELETABLE_STATUSES.has(automation.status);
  const isPendingReview = automation.status === "pending_review";
  const showReject = isPendingReview && !automation.automationEnabled;

  const metaParts = [
    `Generation ${automation.generation}`,
    `${automation.numVariants} variant${automation.numVariants === 1 ? "" : "s"}`,
    `evaluates every ${automation.evalLengthDays} day${automation.evalLengthDays === 1 ? "" : "s"}`,
    `${formatMoney(automation.dailyBudgetCents)}/day per ad`,
  ];
  if (automation.nextEvaluationAt && automation.status === "running") {
    metaParts.push(`next evaluation ${new Date(automation.nextEvaluationAt).toLocaleString()}`);
  }

  return (
    <section style={{ marginTop: isFirst ? 0 : 56 }}>
      {/* Loop header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          paddingBottom: 14,
          borderBottom: "1px solid var(--primary)",
          alignItems: "end",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11.5,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color: loopStatusColor(automation.status),
              fontWeight: 700,
            }}
          >
            Loop {loopNumber} · {loopStatusLabel(automation.status)}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              color: "var(--primary)",
              letterSpacing: "-0.3px",
              marginTop: 8,
              overflowWrap: "anywhere",
            }}
          >
            Campaign {automation.metaCampaignId || "—"} · Ad set {automation.metaAdSetId || "—"}
          </div>
          <div style={{ fontSize: 13, color: "#8C8474", marginTop: 3 }}>
            {metaParts.join(" · ")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
          {canDelete && (
            <EditorialTextLink
              onClick={() => onDelete(automation)}
              disabled={busy}
              style={{ fontSize: 13.5, color: "#8C8474", fontWeight: 400 }}
            >
              Delete loop
            </EditorialTextLink>
          )}
          {canLaunch && !automation.automationEnabled && (
            <EditorialPillButton
              onClick={() => onLaunch(automation)}
              disabled={busy}
            >
              {launching ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Spinner size={14} color="#FDF0D5" />
                  Launching…
                </span>
              ) : (
                "Launch new variants to Meta"
              )}
            </EditorialPillButton>
          )}
          {canEvaluate && (
            <EditorialPillButton
              variant="outline"
              onClick={() => onRunEvaluation(automation.id)}
              disabled={busy}
            >
              {automation.status === "evaluating" || automation.status === "generating"
                ? "Evaluating…"
                : "Run evaluation now"}
            </EditorialPillButton>
          )}
        </div>
      </div>

      {feedback && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 0",
            borderBottom: `1px solid ${feedback.type === "success" ? "var(--green)" : "var(--red)"}`,
            fontSize: 14,
            color: feedback.type === "success" ? "var(--green)" : "var(--red)",
            lineHeight: 1.6,
          }}
        >
          {feedback.message}
        </div>
      )}

      {automation.status === "generating" && (
        <GenerationProgressBar automation={automation} />
      )}

      {isPendingReview && !automation.automationEnabled && (
        <EditorialDefinitionRow label="Review before launch">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#4A5A64" }}>
            Click a variant to preview it full-screen. Reject any challenger you don&apos;t want and a
            replacement will be generated. When you&apos;re happy with the set, launch the new variants
            to Meta.
          </p>
        </EditorialDefinitionRow>
      )}

      <EditorialDefinitionRow label="Auto-launch" isLast={currentVariants.length === 0 && archived.length === 0}>
        <label
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(automation.automationEnabled)}
            disabled={busy}
            onChange={(e) => onToggleAutoLaunch(automation.id, e.target.checked)}
            style={{ accentColor: "#C1121F", width: 15, height: 15, marginTop: 3, flexShrink: 0 }}
          />
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "#4A5A64" }}>
            Launch newly generated variants to Meta automatically after each evaluation. When off,
            evaluation and generation still run — you review and launch manually.
          </span>
        </label>
      </EditorialDefinitionRow>

      {currentVariants.length > 0 && (
        <div style={{ padding: "22px 0 8px" }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#8C8474",
              marginBottom: 14,
            }}
          >
            Current generation · gen {automation.generation}
          </div>
          <VariantGrid
            variants={currentVariants}
            isPendingReview={showReject}
            onOpen={onOpenPreview}
            onReject={showReject ? (variant) => onReject(automation, variant) : undefined}
            rejectingId={rejectingId}
          />
        </div>
      )}

      {archived.length > 0 && (
        <div style={{ padding: "22px 0 8px", borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#8C8474",
              marginBottom: 14,
            }}
          >
            Archived after last evaluation ({archived.length})
          </div>
          <VariantGrid
            variants={archived}
            showMetrics
            onOpen={onOpenPreview}
          />
        </div>
      )}

      {automation.error && (
        <div style={{ marginTop: 16, fontSize: 14, color: "var(--red)" }}>{automation.error}</div>
      )}
    </section>
  );
}

function GenerationProgressBar({ automation }: { automation: AutomationRow }) {
  const currentGenVariants = automation.variants.filter(
    (v) => v.generation === automation.generation && (v.role === "base" || v.role === "challenger")
  );
  const challengersNeeded = Math.max(0, automation.numVariants - 1);
  const challengersDone = currentGenVariants.filter((v) => v.role === "challenger").length;
  const baseReady = Boolean(currentGenVariants.find((v) => v.role === "base"));
  const completedCount = challengersDone + (baseReady ? 1 : 0);
  const isVideoBase = currentGenVariants.find((v) => v.role === "base")?.format === "Video";

  const [challengerElapsedSec, setChallengerElapsedSec] = useState(0);
  const [challengerStartedAt, setChallengerStartedAt] = useState(() => Date.now());

  useEffect(() => {
    setChallengerStartedAt(Date.now());
    setChallengerElapsedSec(0);
  }, [automation.generation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setChallengerElapsedSec(Math.floor((Date.now() - challengerStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [challengerStartedAt]);

  useEffect(() => {
    if (challengersDone > 0) {
      setChallengerStartedAt(Date.now());
      setChallengerElapsedSec(0);
    }
  }, [challengersDone]);

  const { progressPercent, progressLabel } = useMemo(() => {
    const slotPercent = 100 / automation.numVariants;
    const finishedPercent = (completedCount / automation.numVariants) * 100;
    const estimatedSecPerChallenger = isVideoBase ? 420 : 90;
    const hasActiveChallenger = challengersDone < challengersNeeded;
    const inSlotPercent = hasActiveChallenger
      ? slotPercent * Math.min(0.92, challengerElapsedSec / estimatedSecPerChallenger)
      : 0;
    const percent = Math.min(
      hasActiveChallenger ? 99 : 100,
      Math.round(Math.max(20, finishedPercent + inSlotPercent))
    );

    let label: string;
    if (completedCount >= automation.numVariants) {
      label = "All variants ready";
    } else if (challengersDone === 0) {
      label =
        challengersNeeded === 0
          ? "Preparing new variant set…"
          : `Generating AI variant 1 of ${challengersNeeded}${
              isVideoBase ? " — video variants may take several minutes" : ""
            }`;
    } else {
      label = `Generating AI variant ${challengersDone + 1} of ${challengersNeeded} (${completedCount} of ${automation.numVariants} ready)`;
    }

    return { progressPercent: percent, progressLabel: label };
  }, [
    automation.numVariants,
    completedCount,
    challengersDone,
    challengersNeeded,
    challengerElapsedSec,
    isVideoBase,
  ]);

  return (
    <div style={{ padding: "22px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Spinner />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              Generating new variants
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{progressLabel}</div>
          </div>
        </div>
        {challengerElapsedSec > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
            Elapsed {formatElapsed(challengerElapsedSec)}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
        <span>{completedCount} of {automation.numVariants} variants ready</span>
        <span>{progressPercent}%</span>
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.max(progressPercent, 4)}%`,
            borderRadius: 999,
            background: "var(--primary)",
            transition: "width 1s linear",
          }}
        />
      </div>
    </div>
  );
}

function VariantPreviewOverlay({
  variant,
  onClose,
}: {
  variant: VariantRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isVideo = variant.format === "Video";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          border: "none",
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Close
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {isVideo ? (
          <video
            src={variant.mediaUrl}
            controls
            autoPlay
            playsInline
            style={{
              maxWidth: "90vw",
              maxHeight: "85vh",
              borderRadius: 12,
              background: "#000",
            }}
          />
        ) : (
          <img
            src={variant.mediaUrl}
            alt=""
            style={{
              maxWidth: "90vw",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: 12,
            }}
          />
        )}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "#38678A",
          }}
        >
          {variant.role}
        </div>
      </div>
    </div>
  );
}

function variantDisplayLabel(variant: VariantRow, index: number, isPendingReview: boolean) {
  if (isPendingReview) {
    if (variant.role === "base") return "Base";
    return "Challenger";
  }
  if (variant.role === "archived") return `Archived ${index + 1}`;
  return `Variant ${index + 1}`;
}

function VariantGrid({
  variants,
  isPendingReview = false,
  showMetrics = false,
  onOpen,
  onReject,
  rejectingId,
}: {
  variants: VariantRow[];
  isPendingReview?: boolean;
  showMetrics?: boolean;
  onOpen?: (variant: VariantRow) => void;
  onReject?: (variant: VariantRow) => void;
  rejectingId?: string | null;
}) {
  return (
    <div
      className="editorial-preview-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 24,
      }}
    >
      {variants.map((variant, index) => {
        const canReject = onReject && variant.role === "challenger";
        const isRejecting = rejectingId === variant.id;
        const label = variantDisplayLabel(variant, index, isPendingReview);
        const isBase = variant.role === "base";

        return (
          <div key={variant.id} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => onOpen?.(variant)}
              disabled={!onOpen}
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: onOpen ? "pointer" : "default",
              }}
            >
              <div style={{ width: "100%", aspectRatio: "4/5", borderRadius: 10, overflow: "hidden" }}>
                {variant.format === "Video" ? (
                  <video
                    src={variant.mediaUrl}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={variant.mediaUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
              </div>
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  color: isBase ? "#38678A" : "#8C8474",
                }}
              >
                {label}
              </div>
              {canReject && (
                <button
                  type="button"
                  onClick={() => onReject(variant)}
                  disabled={Boolean(rejectingId)}
                  style={rejectLinkStyle}
                >
                  {isRejecting ? "Regenerating…" : "Reject & regenerate"}
                </button>
              )}
            </div>

            {showMetrics && variant.metrics && (
              <div style={{ fontSize: 11, color: "#8C8474", lineHeight: 1.5 }}>
                Spend {formatMetricMoney(variant.metrics.spend)} · Clicks {variant.metrics.clicks || "0"}
                {variant.metrics.ctr ? ` · CTR ${variant.metrics.ctr}%` : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const rejectLinkStyle: CSSProperties = {
  background: "none",
  border: "none",
  borderBottom: "1px solid #C1121F",
  padding: 0,
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  color: "#C1121F",
  cursor: "pointer",
};
