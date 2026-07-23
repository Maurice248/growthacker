"use client";

import { useEffect, useState } from "react";
import {
  EditorialPage,
  EditorialPageHeader,
  EditorialSectionHeader,
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialPillButton,
  EditorialTextLink,
  Spinner,
} from "./components";

type SocialPlatform = "facebook" | "instagram" | "linkedin" | "tiktok" | "x" | "youtube";

type SocialPostingConfig = {
  defaultImageRatio: string;
  uploadPostUser: string;
  facebookPageId: string;
  linkedinOrgUrn: string;
  tiktokHandle: string;
  enabledPlatforms: SocialPlatform[];
};

type SocialBrandPromptContext = {
  brandAbout: string;
  brandMission: string;
  brandServices: string;
  brandAudience: string;
  brandWebsite: string;
  tone: string;
};

const EMPTY_POSTING_CONFIG: SocialPostingConfig = {
  defaultImageRatio: "1:1",
  uploadPostUser: "",
  facebookPageId: "",
  linkedinOrgUrn: "",
  tiktokHandle: "",
  enabledPlatforms: ["facebook", "instagram", "linkedin", "tiktok"],
};

const EMPTY_BRAND_CONTEXT: SocialBrandPromptContext = {
  brandAbout: "",
  brandMission: "",
  brandServices: "",
  brandAudience: "",
  brandWebsite: "",
  tone: "",
};

const PLATFORM_OPTIONS: { id: SocialPlatform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
];

const BRAND_PROMPT_FIELDS: {
  key: keyof SocialBrandPromptContext;
  label: string;
  labelSub: string;
  multiline?: boolean;
  rows?: number;
}[] = [
  { key: "brandAbout", label: "Brand Description", labelSub: "Positioning", multiline: true, rows: 3 },
  { key: "brandMission", label: "Mission", labelSub: "Value Proposition", multiline: true, rows: 2 },
  { key: "brandServices", label: "Services", labelSub: "Products & Services", multiline: true, rows: 2 },
  { key: "brandAudience", label: "Target Audience", labelSub: "ICP - Social Channels", multiline: true, rows: 2 },
  { key: "brandWebsite", label: "Website", labelSub: "Destination URL" },
  { key: "tone", label: "Brand Tone", labelSub: "Brand Voice", rows: 1 },
];

function pipelineStatusTone(status: string) {
  const value = status.toLowerCase();
  if (
    value.includes("success") ||
    value.includes("completed") ||
    value.includes("ready") ||
    value.includes("posted")
  ) {
    return { label: "Completed", color: "var(--green)", bg: "var(--green-light)" };
  }
  if (value.includes("error") || value.includes("failed") || value.includes("rejected")) {
    return { label: "Needs attention", color: "var(--red)", bg: "var(--red-light)" };
  }
  if (
    value.includes("generating") ||
    value.includes("accepting") ||
    value.includes("stitching") ||
    value.includes("polling") ||
    value.includes("creation")
  ) {
    return { label: "In progress", color: "var(--primary)", bg: "var(--primary-light)" };
  }
  return { label: "Idle", color: "var(--text-muted)", bg: "var(--surface)" };
}

function OverviewStatCell({
  label,
  value,
  sub,
  labelColor = "var(--text-muted)",
  isFirst,
  isLast,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  labelColor?: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        padding: isFirst ? "24px 24px 24px 0" : isLast ? "24px 0 24px 24px" : "24px",
        borderRight: isLast ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: labelColor }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--primary)", marginTop: 8 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

type SocialOverviewProps = {
  onEditBrandContext?: () => void;
};

export default function SocialOverview({ onEditBrandContext }: SocialOverviewProps) {
  const [pipelineStatus, setPipelineStatus] = useState("Loading...");
  const [postingConfig, setPostingConfig] = useState<SocialPostingConfig>(EMPTY_POSTING_CONFIG);
  const [brandContext, setBrandContext] = useState<SocialBrandPromptContext>(EMPTY_BRAND_CONTEXT);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pipelineTone = pipelineStatusTone(pipelineStatus);
  const brandContextReady = Boolean(brandContext.brandAbout || brandContext.brandMission);
  const configReady = Boolean(postingConfig.uploadPostUser && brandContextReady);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [configRes, statusRes] = await Promise.all([
          fetch("/api/social-studio/config"),
          fetch("/api/social-studio/job?latest=status"),
        ]);

        if (!active) return;

        if (configRes.ok) {
          const data = await configRes.json();
          setLoadError(null);
          if (data.config) {
            setPostingConfig({
              defaultImageRatio: data.config.defaultImageRatio || "1:1",
              uploadPostUser: data.config.uploadPostUser || "",
              facebookPageId: data.config.facebookPageId || "",
              linkedinOrgUrn: data.config.linkedinOrgUrn || "",
              tiktokHandle: data.config.tiktokHandle || "",
              enabledPlatforms: data.config.enabledPlatforms || EMPTY_POSTING_CONFIG.enabledPlatforms,
            });
          }
          if (data.context) {
            setBrandContext({
              brandAbout: data.context.brandAbout || "",
              brandMission: data.context.brandMission || "",
              brandServices: data.context.brandServices || "",
              brandAudience: data.context.brandAudience || "",
              brandWebsite: data.context.brandWebsite || "",
              tone: data.context.tone || "",
            });
            if (data.context.companyName) setCompanyName(data.context.companyName);
          }
        } else {
          const errBody = await configRes.json().catch(() => ({}));
          setLoadError(errBody.error || `Failed to load settings (${configRes.status})`);
        }

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setPipelineStatus(statusData.status || "Waiting for data...");
        } else {
          setPipelineStatus("Status unavailable");
        }
      } catch {
        if (active) setPipelineStatus("Connection error");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/social-studio/job?latest=status");
        if (res.ok) {
          const data = await res.json();
          setPipelineStatus(data.status || "Waiting for data...");
        }
      } catch {
        // ignore
      }
    }, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/social-studio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postingConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveMsg("Posting configuration saved");
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setPostingConfig((prev) => {
      const enabled = prev.enabledPlatforms.includes(platform)
        ? prev.enabledPlatforms.filter((p) => p !== platform)
        : [...prev.enabledPlatforms, platform];
      return { ...prev, enabledPlatforms: enabled };
    });
  };

  return (
    <EditorialPage>
      <EditorialPageHeader
        eyebrow="Social Channels"
        title="Overview"
        subtitle="Posting settings for Creator Studio. Brand copy for AI prompts comes from Configuration → Brand Context."
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          borderTop: "1px solid var(--primary)",
        }}
      >
        <OverviewStatCell
          isFirst
          label="Pipeline ready"
          labelColor="#38678A"
          value={configReady ? "Configured" : "Setup"}
          sub={configReady ? "Brand context + posting settings ready" : "Complete Brand Context and posting settings"}
        />
        <OverviewStatCell
          label="Company"
          value={companyName || "—"}
          sub={brandContextReady ? "Brand Context loaded for AI prompts" : "Add Brand Context in Configuration"}
        />
        <OverviewStatCell
          isLast
          label="Pipeline state"
          labelColor="#38678A"
          value={pipelineTone.label}
          sub={pipelineStatus}
        />
      </section>

      {loadError && (
        <p style={{ fontSize: 13, color: "var(--red)", margin: "16px 0 0" }}>{loadError}</p>
      )}

      <section style={{ marginTop: 48 }}>
        <EditorialSectionHeader title="Live Pipeline Status" meta="Creator Studio" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr",
            gap: "0 40px",
            padding: "24px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>Current status</div>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 19,
                color: "#38678A",
              }}
            >
              {pipelineTone.label === "In progress" && <Spinner size={14} color="#38678A" />}
              {pipelineStatus}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "#4A5A64" }}>
              Status updates from your company&apos;s Creator Studio jobs. AI prompts use Brand Context from Configuration — companies never edit prompt templates directly.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spinner size={24} color="var(--primary)" />
        </div>
      ) : (
        <>
          <section style={{ marginTop: 48 }}>
            <EditorialSectionHeader
              title="Brand Context for AI Prompts"
              meta="From Configuration → Brand Context"
            />
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "#4A5A64" }}>
              Creator Studio image, copy, and video prompts use this brand data automatically. Edit it in{" "}
              {onEditBrandContext ? (
                <EditorialTextLink onClick={onEditBrandContext} style={{ fontSize: 14 }}>
                  Configuration → Brand Context
                </EditorialTextLink>
              ) : (
                <strong>Configuration → Brand Context</strong>
              )}
              .
            </p>
            <EditorialDefinitionList>
              {BRAND_PROMPT_FIELDS.map((field, index) => (
                <EditorialDefinitionRow
                  key={field.key}
                  label={field.label}
                  labelSub={field.labelSub}
                  isLast={index === BRAND_PROMPT_FIELDS.length - 1}
                >
                  <EditorialField
                    value={brandContext[field.key]}
                    onChange={() => {}}
                    disabled
                    multiline={field.multiline}
                    rows={field.rows}
                    placeholder={`Set in Brand Context (${field.labelSub})`}
                  />
                </EditorialDefinitionRow>
              ))}
            </EditorialDefinitionList>
          </section>

          <section style={{ marginTop: 48 }}>
            <EditorialSectionHeader title="Posting Configuration" meta="Platforms and Upload Post credentials" />
            <EditorialDefinitionList>
              <EditorialDefinitionRow label="Default Image Ratio">
                <EditorialField
                  value={postingConfig.defaultImageRatio}
                  onChange={(v) => setPostingConfig({ ...postingConfig, defaultImageRatio: v })}
                  placeholder="1:1"
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Upload Post User">
                <EditorialField
                  value={postingConfig.uploadPostUser}
                  onChange={(v) => setPostingConfig({ ...postingConfig, uploadPostUser: v })}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Facebook Page ID">
                <EditorialField
                  value={postingConfig.facebookPageId}
                  onChange={(v) => setPostingConfig({ ...postingConfig, facebookPageId: v })}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="LinkedIn Org URN">
                <EditorialField
                  value={postingConfig.linkedinOrgUrn}
                  onChange={(v) => setPostingConfig({ ...postingConfig, linkedinOrgUrn: v })}
                  placeholder="urn:li:organization:..."
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="TikTok Handle">
                <EditorialField
                  value={postingConfig.tiktokHandle}
                  onChange={(v) => setPostingConfig({ ...postingConfig, tiktokHandle: v })}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Enabled Platforms" isLast>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PLATFORM_OPTIONS.map((p) => {
                    const active = postingConfig.enabledPlatforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        style={{
                          borderRadius: 999,
                          padding: "6px 14px",
                          fontSize: 13.5,
                          cursor: "pointer",
                          background: "transparent",
                          border: `1px solid ${active ? "var(--primary)" : "#C2B79A"}`,
                          color: active ? "var(--primary)" : "#8C8474",
                          fontWeight: active ? 700 : 400,
                        }}
                      >
                        {active ? `✓ ${p.label}` : p.label}
                      </button>
                    );
                  })}
                </div>
              </EditorialDefinitionRow>
            </EditorialDefinitionList>

            <footer
              style={{
                marginTop: 28,
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
                Brand copy is managed in Configuration → Brand Context and injected into Creator Studio prompts.
              </span>
              {saveMsg && (
                <span
                  style={{
                    fontSize: 13,
                    color: saveMsg.includes("failed") ? "var(--red)" : "var(--green)",
                  }}
                >
                  {saveMsg}
                </span>
              )}
              <EditorialPillButton variant="danger" onClick={handleSave} disabled={saving} style={{ marginLeft: "auto", padding: "10px 24px", whiteSpace: "nowrap" }}>
                {saving ? <Spinner size={14} color="#fff" /> : "Save posting configuration"}
              </EditorialPillButton>
            </footer>
          </section>
        </>
      )}

      <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.3</div>
    </EditorialPage>
  );
}
