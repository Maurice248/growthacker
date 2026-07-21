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
  Spinner,
} from "./components";

type SocialPlatform = "facebook" | "instagram" | "linkedin" | "tiktok" | "x" | "youtube";

type SocialConfigForm = {
  brandAbout: string;
  brandMission: string;
  brandServices: string;
  brandAudience: string;
  brandWebsite: string;
  tone: string;
  defaultImageRatio: string;
  uploadPostUser: string;
  facebookPageId: string;
  linkedinOrgUrn: string;
  tiktokHandle: string;
  enabledPlatforms: SocialPlatform[];
};

const EMPTY_CONFIG: SocialConfigForm = {
  brandAbout: "",
  brandMission: "",
  brandServices: "",
  brandAudience: "",
  brandWebsite: "",
  tone: "",
  defaultImageRatio: "1:1",
  uploadPostUser: "",
  facebookPageId: "",
  linkedinOrgUrn: "",
  tiktokHandle: "",
  enabledPlatforms: ["facebook", "instagram", "linkedin", "tiktok"],
};

const PLATFORM_OPTIONS: { id: SocialPlatform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
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

export default function SocialOverview() {
  const [pipelineStatus, setPipelineStatus] = useState("Loading...");
  const [config, setConfig] = useState<SocialConfigForm>(EMPTY_CONFIG);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pipelineTone = pipelineStatusTone(pipelineStatus);
  const configReady = Boolean(config.uploadPostUser && config.brandAbout);

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
            setConfig({
              brandAbout: data.config.brandAbout || "",
              brandMission: data.config.brandMission || "",
              brandServices: data.config.brandServices || "",
              brandAudience: data.config.brandAudience || "",
              brandWebsite: data.config.brandWebsite || "",
              tone: data.config.tone || "",
              defaultImageRatio: data.config.defaultImageRatio || "1:1",
              uploadPostUser: data.config.uploadPostUser || "",
              facebookPageId: data.config.facebookPageId || "",
              linkedinOrgUrn: data.config.linkedinOrgUrn || "",
              tiktokHandle: data.config.tiktokHandle || "",
              enabledPlatforms: data.config.enabledPlatforms || EMPTY_CONFIG.enabledPlatforms,
            });
          } else if (data.context) {
            setConfig((prev) => ({
              ...prev,
              brandAbout: data.context.brandAbout || prev.brandAbout,
              brandMission: data.context.brandMission || prev.brandMission,
              brandServices: data.context.brandServices || prev.brandServices,
              brandAudience: data.context.brandAudience || prev.brandAudience,
              brandWebsite: data.context.brandWebsite || prev.brandWebsite,
              tone: data.context.tone || prev.tone,
            }));
          }
          if (data.context?.companyName) setCompanyName(data.context.companyName);
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
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaveMsg("Settings saved");
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setConfig((prev) => {
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
        subtitle="Configure your brand context for AI prompts and monitor the native Creator Studio pipeline."
        style={{ marginBottom: 40 }}
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
          sub={configReady ? "Brand + posting settings saved" : "Complete settings below"}
        />
        <OverviewStatCell
          label="Company"
          value={companyName || "—"}
          sub="Brand context injected into AI prompts"
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
              Status updates from your company&apos;s Creator Studio jobs. AI prompts use the brand settings below — companies never edit prompt templates directly.
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
            <EditorialSectionHeader title="Social Settings" meta="Feeds all Creator Studio AI prompts" />
            <EditorialDefinitionList>
              <EditorialDefinitionRow label="Brand About">
                <EditorialField
                  value={config.brandAbout}
                  onChange={(v) => setConfig({ ...config, brandAbout: v })}
                  multiline
                  placeholder="What your company does"
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Mission">
                <EditorialField
                  value={config.brandMission}
                  onChange={(v) => setConfig({ ...config, brandMission: v })}
                  multiline
                  rows={2}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Services">
                <EditorialField
                  value={config.brandServices}
                  onChange={(v) => setConfig({ ...config, brandServices: v })}
                  multiline
                  rows={2}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Target Audience">
                <EditorialField
                  value={config.brandAudience}
                  onChange={(v) => setConfig({ ...config, brandAudience: v })}
                  multiline
                  rows={2}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Website">
                <EditorialField
                  value={config.brandWebsite}
                  onChange={(v) => setConfig({ ...config, brandWebsite: v })}
                  placeholder="https://yourcompany.com"
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Brand Tone">
                <EditorialField
                  value={config.tone}
                  onChange={(v) => setConfig({ ...config, tone: v })}
                  placeholder="Professional, trustworthy, and landlord-focused"
                  rows={1}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Default Image Ratio" isLast>
                <EditorialField
                  value={config.defaultImageRatio}
                  onChange={(v) => setConfig({ ...config, defaultImageRatio: v })}
                  placeholder="1:1"
                />
              </EditorialDefinitionRow>
            </EditorialDefinitionList>
          </section>

          <section style={{ marginTop: 48 }}>
            <EditorialSectionHeader title="Posting Configuration" />
            <EditorialDefinitionList>
              <EditorialDefinitionRow label="Upload Post User">
                <EditorialField
                  value={config.uploadPostUser}
                  onChange={(v) => setConfig({ ...config, uploadPostUser: v })}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Facebook Page ID">
                <EditorialField
                  value={config.facebookPageId}
                  onChange={(v) => setConfig({ ...config, facebookPageId: v })}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="LinkedIn Org URN">
                <EditorialField
                  value={config.linkedinOrgUrn}
                  onChange={(v) => setConfig({ ...config, linkedinOrgUrn: v })}
                  placeholder="urn:li:organization:..."
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="TikTok Handle">
                <EditorialField
                  value={config.tiktokHandle}
                  onChange={(v) => setConfig({ ...config, tiktokHandle: v })}
                />
              </EditorialDefinitionRow>
              <EditorialDefinitionRow label="Enabled Platforms" isLast>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PLATFORM_OPTIONS.map((p) => {
                    const active = config.enabledPlatforms.includes(p.id);
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
                This brand data is injected into all Creator Studio AI prompts automatically.
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
              <EditorialPillButton onClick={handleSave} disabled={saving} style={{ marginLeft: "auto" }}>
                {saving ? <Spinner size={14} color="#FDF0D5" /> : "Save social settings"}
              </EditorialPillButton>
            </footer>
          </section>
        </>
      )}

      <div style={{ marginTop: 56, fontSize: 12, color: "#B0A88F" }}>version 0.2</div>
    </EditorialPage>
  );
}
