"use client";

import { useEffect, useState } from "react";
import { Activity, Save, Share2 } from "lucide-react";
import { Badge, Card, MetricCard, SectionTitle, Spinner } from "./components";

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

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const style: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-light)",
    fontSize: 13,
    fontFamily: "inherit",
    background: "#fff",
    color: "var(--text)",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...style, resize: "vertical", minHeight: 72 }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={style}
        />
      )}
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
    <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Share2 size={24} color="var(--primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
            Social Channels Overview
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Configure your brand context for AI prompts and monitor the native Creator Studio pipeline.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4" style={{ marginBottom: 24 }}>
        <MetricCard
          label="Pipeline ready"
          value={configReady ? "Configured" : "Needs setup"}
          sub={configReady ? "Brand + posting settings saved" : "Complete Social settings below"}
          color={configReady ? "var(--green)" : "var(--amber)"}
          bg={configReady ? "var(--green-light)" : "var(--amber-light)"}
        />
        <MetricCard
          label="Company"
          value={companyName || "—"}
          sub="Brand context injected into AI prompts"
          color="var(--primary)"
          bg="var(--primary-light)"
        />
        <MetricCard
          label="Pipeline state"
          value={pipelineTone.label}
          sub={pipelineStatus}
          color={pipelineTone.color}
          bg={pipelineTone.bg}
        />
      </div>

      {loadError && (
        <p style={{ fontSize: 12, color: "var(--red)", margin: "0 0 16px 0" }}>
          {loadError}
        </p>
      )}

      <div className="flex flex-col items-center gap-4">
        <Card
          className="w-full lg:w-[55%]"
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #f8fafc, #eff6ff)",
            border: "1px solid #bfdbfe",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Activity size={16} color="var(--primary)" />
            <SectionTitle style={{ margin: 0, color: "var(--primary)" }}>Live Pipeline Status</SectionTitle>
          </div>
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
              Current status
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 15,
                fontWeight: 700,
                color: pipelineTone.color,
                marginBottom: 12,
              }}
            >
              {pipelineTone.label === "In progress" && <Spinner size={14} color="var(--primary)" />}
              {pipelineStatus}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Status updates from your company&apos;s Creator Studio jobs. AI prompts use the brand settings below — companies never edit prompt templates directly.
            </div>
          </div>
        </Card>

        <Card className="w-full lg:w-[55%]" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <SectionTitle style={{ margin: 0 }}>Social Settings</SectionTitle>
            <Badge
              text="Feeds AI prompts"
              color="var(--primary)"
              bg="var(--primary-light)"
            />
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <Spinner size={24} color="var(--primary)" />
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                This brand data is injected into all Creator Studio AI prompts automatically.
              </p>

              <Field label="Brand About" value={config.brandAbout} onChange={(v) => setConfig({ ...config, brandAbout: v })} multiline placeholder="What your company does and who it serves" />
              <Field label="Mission" value={config.brandMission} onChange={(v) => setConfig({ ...config, brandMission: v })} multiline />
              <Field label="Services" value={config.brandServices} onChange={(v) => setConfig({ ...config, brandServices: v })} multiline />
              <Field label="Target Audience" value={config.brandAudience} onChange={(v) => setConfig({ ...config, brandAudience: v })} multiline />
              <Field label="Website" value={config.brandWebsite} onChange={(v) => setConfig({ ...config, brandWebsite: v })} placeholder="https://yourcompany.com" />
              <Field label="Brand Tone" value={config.tone} onChange={(v) => setConfig({ ...config, tone: v })} placeholder="professional, trustworthy, landlord-focused" />
              <Field label="Default Image Ratio" value={config.defaultImageRatio} onChange={(v) => setConfig({ ...config, defaultImageRatio: v })} placeholder="1:1 or 9:16" />

              <div style={{ borderTop: "1px solid var(--border-light)", margin: "20px 0", paddingTop: 16 }}>
                <SectionTitle style={{ margin: "0 0 12px 0", fontSize: 14 }}>Posting Configuration</SectionTitle>
                <Field label="Upload Post User" value={config.uploadPostUser} onChange={(v) => setConfig({ ...config, uploadPostUser: v })} placeholder="your-upload-post-profile" />
                <Field label="Facebook Page ID" value={config.facebookPageId} onChange={(v) => setConfig({ ...config, facebookPageId: v })} />
                <Field label="LinkedIn Org URN" value={config.linkedinOrgUrn} onChange={(v) => setConfig({ ...config, linkedinOrgUrn: v })} placeholder="urn:li:organization:..." />
                <Field label="TikTok Handle" value={config.tiktokHandle} onChange={(v) => setConfig({ ...config, tiktokHandle: v })} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>Enabled Platforms</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PLATFORM_OPTIONS.map((p) => {
                    const active = config.enabledPlatforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 20,
                          border: `1px solid ${active ? "var(--primary)" : "var(--border-light)"}`,
                          background: active ? "var(--primary-light)" : "#fff",
                          color: active ? "var(--primary)" : "var(--text-muted)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: "var(--primary)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? <Spinner size={14} color="#fff" /> : <Save size={14} />}
                Save Social Settings
              </button>
              {saveMsg && (
                <p style={{ fontSize: 12, color: saveMsg.includes("failed") || saveMsg.includes("Save failed") ? "var(--red)" : "var(--green)", marginTop: 10 }}>
                  {saveMsg}
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
