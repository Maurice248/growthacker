"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Card, Badge, SectionTitle, Spinner } from "./components";

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

const ACTIVE_STATUSES = new Set(["evaluating", "generating"]);
const DELETABLE_STATUSES = new Set(["pending_review", "generating", "error"]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 960, margin: "0 auto" }}>
      <div>
        <SectionTitle>Automated Campaigns</SectionTitle>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8, lineHeight: 1.6 }}>
          Evaluates your running ad sets, picks the best performer, archives losers, and generates new variants.
          Use the toggle to auto-launch new variants to Meta, or review them first before launching.
        </div>
      </div>

      {error && (
        <Card style={{ background: "var(--red-light)", border: "1px solid var(--red-strong)", padding: 12 }}>
          <div style={{ color: "var(--red-strong)", fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Your automation loops</div>
          <button
            type="button"
            onClick={fetchAutomations}
            disabled={loading}
            style={secondaryBtn}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading && automations.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 24, justifyContent: "center" }}>
            <Spinner />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading automations...</span>
          </div>
        ) : automations.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            No automated campaigns yet. Use <strong>Generate Ad Variants</strong> to create your first variant set,
            launch it in <strong>Campaign Setup</strong>, then return here to manage the evaluation loop.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {automations.map((automation) => {
              const busy =
                actionId === automation.id ||
                launchingId === automation.id ||
                ACTIVE_STATUSES.has(automation.status);
              const cardFeedback =
                feedback?.automationId === automation.id ? feedback : null;
              const currentVariants = automation.variants.filter(
                (v) => v.generation === automation.generation
              );
              const archived = automation.variants.filter((v) => v.role === "archived");
              const winner = automation.variants.find((v) => v.role === "winner");
              const canEvaluate =
                automation.status === "running" && Boolean(automation.metaAdSetId);
              const canLaunch =
                automation.status === "pending_review" && currentVariants.length > 0;
              const canDelete = DELETABLE_STATUSES.has(automation.status);

              return (
                <div
                  key={automation.id}
                  style={{
                    border: "1px solid var(--border-light)",
                    borderRadius: 12,
                    padding: 16,
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        Campaign {automation.metaCampaignId || "—"} · Ad set {automation.metaAdSetId || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        Generation {automation.generation} · {automation.numVariants} variants · evaluates every{" "}
                        {automation.evalLengthDays} day{automation.evalLengthDays === 1 ? "" : "s"} ·{" "}
                        {formatMoney(automation.dailyBudgetCents)}/day per ad
                      </div>
                      {automation.nextEvaluationAt && automation.status === "running" && (
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                          Next scheduled evaluation: {new Date(automation.nextEvaluationAt).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {canEvaluate && (
                        <button
                          type="button"
                          onClick={() => runEvaluation(automation.id)}
                          disabled={busy}
                          style={primaryBtn}
                        >
                          {automation.status === "evaluating" || automation.status === "generating"
                            ? "Evaluating..."
                            : "Run evaluation now"}
                        </button>
                      )}
                      {canLaunch && !automation.automationEnabled && (
                        <button
                          type="button"
                          onClick={() => launchReviewedVariants(automation)}
                          disabled={busy}
                          style={{
                            ...primaryBtn,
                            opacity: launchingId === automation.id ? 0.85 : 1,
                          }}
                        >
                          {launchingId === automation.id ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <Spinner size={14} color="#fff" />
                              Launching to Meta...
                            </span>
                          ) : (
                            "Launch new variants to Meta"
                          )}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteAutomation(automation)}
                          disabled={actionId === automation.id}
                          style={dangerBtn}
                        >
                          Delete loop
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
                    <Badge
                      text={automation.status.replace(/_/g, " ")}
                      color={
                        automation.status === "running"
                          ? "var(--green)"
                          : automation.status === "pending_review"
                            ? "var(--primary)"
                            : "var(--amber)"
                      }
                      bg={
                        automation.status === "running"
                          ? "var(--green-light)"
                          : automation.status === "pending_review"
                            ? "var(--primary-light)"
                            : "var(--amber-light)"
                      }
                    />
                    {winner &&
                      (automation.status === "pending_review" ||
                        automation.status === "evaluating" ||
                        automation.status === "generating") && (
                      <Badge text="Winner selected" color="var(--green)" bg="var(--green-light)" />
                    )}
                    {automation.status === "pending_review" && (
                      <Badge text="New variants ready" color="var(--primary)" bg="var(--primary-light)" />
                    )}
                  </div>

                  {cardFeedback && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 10,
                        border:
                          cardFeedback.type === "success"
                            ? "1px solid var(--green)"
                            : "1px solid var(--red-strong)",
                        background:
                          cardFeedback.type === "success"
                            ? "var(--green-light)"
                            : "var(--red-light)",
                        fontSize: 12,
                        color:
                          cardFeedback.type === "success"
                            ? "var(--green)"
                            : "var(--red-strong)",
                        lineHeight: 1.6,
                      }}
                    >
                      {cardFeedback.message}
                    </div>
                  )}

                  {automation.status === "generating" && (
                    <GenerationProgressBar automation={automation} />
                  )}

                  {automation.status === "pending_review" && !automation.automationEnabled && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--primary-light)",
                        background: "var(--primary-light)",
                        fontSize: 12,
                        color: "var(--text)",
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>Review before launch:</strong> Click a variant to preview it full-screen.
                      Reject any challenger you do not want and a replacement will be generated.
                      When you are happy with the set, click{" "}
                      <strong>Launch new variants to Meta</strong>.
                    </div>
                  )}

                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--border-light)",
                      background: "var(--card-bg)",
                      cursor: busy ? "not-allowed" : "pointer",
                      opacity: busy ? 0.7 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(automation.automationEnabled)}
                      disabled={busy}
                      onChange={(e) => toggleAutoLaunch(automation.id, e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Auto-launch new variants</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                        When on, newly generated variants are launched to Meta automatically after each evaluation.
                        When off, evaluation and generation still run — you review and launch manually.
                      </div>
                    </div>
                  </label>

                  {currentVariants.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)" }}>
                        Current generation (gen {automation.generation})
                      </div>
                      <VariantGrid
                        variants={currentVariants}
                        onOpen={setPreview}
                        onReject={
                          automation.status === "pending_review" && !automation.automationEnabled
                            ? (variant) => rejectVariant(automation, variant)
                            : undefined
                        }
                        rejectingId={rejectingId}
                      />
                    </div>
                  )}

                  {archived.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)" }}>
                        Archived after last evaluation ({archived.length})
                      </div>
                      <VariantGrid variants={archived} showMetrics onOpen={setPreview} />
                    </div>
                  )}

                  {automation.error && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--red-strong)" }}>
                      {automation.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {preview && <VariantPreviewOverlay variant={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
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
          ? "Preparing new variant set..."
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
    <Card
      style={{
        marginTop: 14,
        border: "1px solid var(--primary-light)",
        background: "var(--primary-light)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
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
            width: `${Math.max(progressPercent, 4)}%`,
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--primary), #60a5fa)",
            transition: "width 1s linear",
            boxShadow: progressPercent < 100 ? "0 0 8px rgba(59,130,246,0.35)" : "none",
          }}
        />
      </div>
    </Card>
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
        <Badge
          text={variant.role}
          color="var(--primary)"
          bg="var(--primary-light)"
        />
      </div>
    </div>
  );
}

function VariantGrid({
  variants,
  showMetrics = false,
  onOpen,
  onReject,
  rejectingId,
}: {
  variants: VariantRow[];
  showMetrics?: boolean;
  onOpen?: (variant: VariantRow) => void;
  onReject?: (variant: VariantRow) => void;
  rejectingId?: string | null;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 10,
      }}
    >
      {variants.map((variant) => {
        const canReject = onReject && variant.role === "challenger";
        const isRejecting = rejectingId === variant.id;

        return (
          <div
            key={variant.id}
            style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}
          >
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
              <div style={{ aspectRatio: "9/16", background: "#0f172a", position: "relative" }}>
                {variant.format === "Video" ? (
                  <video
                    src={variant.mediaUrl}
                    style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                  />
                ) : (
                  <img
                    src={variant.mediaUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </div>
            </button>
            <div style={{ padding: 8 }}>
              <Badge
                text={variant.role}
                color={
                  variant.role === "winner"
                    ? "var(--green)"
                    : variant.role === "archived"
                      ? "var(--text-muted)"
                      : "var(--primary)"
                }
                bg={
                  variant.role === "winner"
                    ? "var(--green-light)"
                    : variant.role === "archived"
                      ? "var(--surface)"
                      : "var(--primary-light)"
                }
              />
              {showMetrics && variant.metrics && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                  Spend {formatMetricMoney(variant.metrics.spend)}
                  <br />
                  Clicks {variant.metrics.clicks || "0"}
                  {variant.metrics.ctr ? ` · CTR ${variant.metrics.ctr}%` : ""}
                </div>
              )}
              {canReject && (
                <button
                  type="button"
                  onClick={() => onReject(variant)}
                  disabled={Boolean(rejectingId)}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--red-strong)",
                    background: "#fff",
                    color: "var(--red-strong)",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: rejectingId ? "not-allowed" : "pointer",
                    opacity: rejectingId && !isRejecting ? 0.5 : 1,
                  }}
                >
                  {isRejecting ? "Regenerating..." : "Reject & regenerate"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const primaryBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--primary)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#fff",
  fontSize: 12,
  cursor: "pointer",
};

const dangerBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--red-strong)",
  background: "#fff",
  color: "var(--red-strong)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
