"use client";

import { useEffect, useState } from "react";
import { useCampaigns, Campaign } from "@/context/CampaignContext";
import TimezoneSelect from "./TimezoneSelect";
import { OutreachMetricInput } from "@/components/cold-email/outreach-ui";
import SettingsRequiredAlert, { CAMPAIGN_REQUIRED_SETTINGS } from "./SettingsRequiredAlert";
import "./newsletter.css";

const SUBSCRIBER_OPTIONS = ["50", "150", "200", "All Subscribers"];
const DAILY_LIMIT_OPTIONS = [30, 40, 50, 60, 70, 80, 90, 100];

type Status = "idle" | "loading" | "success" | "error";

type TemplateOption = {
  id: string;
  subjectLine: string;
  service: string;
  topic: string;
  createdAt: string;
};

export default function CreateCampaign() {
  const { history, addCampaign, clearHistory } = useCampaigns();

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [subscribers, setSubscribers] = useState("");
  const [dailyLimit, setDailyLimit] = useState<number | "">("");
  const [sendHour, setSendHour] = useState(10);
  const [sendMinute, setSendMinute] = useState(30);
  const [sendTimezone, setSendTimezone] = useState("America/Toronto");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastCampaignId, setLastCampaignId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [runningId, setRunningId] = useState("");

  useEffect(() => {
    fetch("/api/newsletter/template")
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setTemplates(json.templates || []);
      })
      .catch(() => {});

    fetch("/api/newsletter/config")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return;
        const cfg = json.config || {};
        const ctx = json.context || {};
        setSendHour(cfg.sendHour ?? ctx.sendHour ?? 10);
        setSendMinute(cfg.sendMinute ?? ctx.sendMinute ?? 30);
        setSendTimezone(cfg.sendTimezone ?? ctx.sendTimezone ?? "America/Toronto");
        if (cfg.dailyLimit ?? ctx.dailyLimit) {
          setDailyLimit(cfg.dailyLimit ?? ctx.dailyLimit);
        }
      })
      .catch(() => {});
  }, []);

  const canSubmit = templateId.trim() && campaignName.trim() && subscribers && dailyLimit !== "";

  const handleCreate = async () => {
    if (!canSubmit) return;
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: templateId.trim(),
          campaignName: campaignName.trim(),
          subscribers,
          dailyLimit,
          sendHour,
          sendMinute,
          sendTimezone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.statusText}`);

      const campaignId =
        data?.["campaign id"] || data?.campaignId || data?.campaign_id || data?.id || "";

      const campaign: Campaign = {
        campaignId,
        campaignName: campaignName.trim(),
        templateId: templateId.trim(),
        subscribers,
        dailyLimit: dailyLimit as number,
        createdAt: new Date().toISOString(),
      };

      addCampaign(campaign);
      setLastCampaignId(campaignId);
      setStatus("success");
      setTemplateId("");
      setCampaignName("");
      setSubscribers("");
      setDailyLimit("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const handleRunNow = async (campaignId: string) => {
    if (!campaignId) return;
    setRunningId(campaignId);
    try {
      const res = await fetch("/api/newsletter/campaigns/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      alert(`Sent ${data.sent ?? 0} emails${data.completed ? " — campaign completed" : ""}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunningId("");
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <div className="nl-root">
      <SettingsRequiredAlert required={CAMPAIGN_REQUIRED_SETTINGS} className="mb-6" />
      <div className="nl-grid nl-grid-2">
        <div>
          <h3 className="nl-section-title">Campaign Setup</h3>

          <div className="nl-field-row">
            <label className="nl-label">
              Template <span className="text-[#C1121F]">*</span>
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="nl-select appearance-none"
            >
              <option value="" disabled>
                Select a saved template
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.subjectLine || t.topic || t.id.slice(0, 8)}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="mt-2 text-xs text-[#8C8474]">
                Generate and authorize a newsletter first to create templates.
              </p>
            )}
          </div>

          <div className="nl-field-row">
            <label className="nl-label">
              Campaign name <span className="text-[#C1121F]">*</span>
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Weekly Tenant Screening Update"
              className="nl-input"
            />
          </div>

          <div className="nl-field-row grid grid-cols-2 gap-5">
            <div>
              <label className="nl-label">
                Subscribers <span className="text-[#C1121F]">*</span>
              </label>
              <select
                value={subscribers}
                onChange={(e) => setSubscribers(e.target.value)}
                className="nl-select appearance-none"
              >
                <option value="" disabled>
                  Select group
                </option>
                {SUBSCRIBER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "All Subscribers" ? "All Subscribers" : `${opt} Subscribers`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="nl-label">
                Daily limit <span className="text-[#C1121F]">*</span>
              </label>
              <select
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="nl-select appearance-none"
              >
                <option value="" disabled>
                  Select limit
                </option>
                {DAILY_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="nl-field-row">
            <label className="nl-label">Timezone</label>
            <TimezoneSelect value={sendTimezone} onChange={setSendTimezone} />
          </div>

          <div
            className="nl-field-row grid border-b border-[var(--border)]"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            <div className="border-r border-[var(--border)] py-4 pr-5">
              <label className="nl-label">Send hour</label>
              <OutreachMetricInput
                value={String(sendHour)}
                onChange={(v) => setSendHour(Number(v))}
                min={0}
                max={23}
              />
            </div>
            <div className="py-4 pl-5">
              <label className="nl-label">Send minute</label>
              <OutreachMetricInput
                value={String(sendMinute)}
                onChange={(v) => setSendMinute(Number(v))}
                min={0}
                max={59}
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!canSubmit || status === "loading"}
            className="nl-btn-primary mt-5"
          >
            {status === "loading" ? "Launching…" : "Launch campaign →"}
          </button>

          {status === "success" && (
            <div className="nl-alert-success">
              <p className="text-[15px] font-bold text-[var(--primary)]">Campaign created</p>
              {lastCampaignId && (
                <div className="mt-3 flex items-center justify-between gap-3 border-b border-[#E8DCC2] pb-3">
                  <code className="truncate font-mono text-xs text-[#4A5A64]">{lastCampaignId}</code>
                  <button
                    type="button"
                    onClick={() => handleCopyId(lastCampaignId)}
                    className="text-[13px] font-bold text-[#8C8474] hover:text-[var(--primary)]"
                  >
                    {copiedId === lastCampaignId ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          )}

          {status === "error" && <div className="nl-alert-error">{errorMessage}</div>}
        </div>

        <div>
          <div className="nl-panel-header">
            <h3 className="nl-panel-title">Command History</h3>
            <span className="nl-count-meta">{history.length} entries</span>
          </div>

          <div className="min-h-[280px]">
            {history.length === 0 ? (
              <div className="nl-chart-empty">No data logs found</div>
            ) : (
              <div>
                {history.length > 0 && (
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={clearHistory}
                      className="text-[13px] text-[#8C8474] hover:text-[#C1121F]"
                    >
                      Clear history
                    </button>
                  </div>
                )}
                {history.map((c) => (
                  <div key={c.campaignId || c.createdAt} className="nl-campaign-row">
                    <p className="text-xs text-[#8C8474]">{formatDate(c.createdAt)}</p>
                    <p className="mt-1 text-[15px] font-bold text-[var(--primary)]">{c.campaignName}</p>
                    <p className="mt-1 text-[13px] text-[#4A5A64]">
                      {c.subscribers === "All Subscribers"
                        ? "All subscribers"
                        : `${c.subscribers} subscribers`}{" "}
                      · {c.dailyLimit}/day
                    </p>
                    {c.campaignId && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#E8DCC2] pt-3">
                        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#8C8474]">
                          {c.campaignId}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyId(c.campaignId)}
                          className="text-[13px] font-bold text-[#8C8474] hover:text-[var(--primary)]"
                        >
                          {copiedId === c.campaignId ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunNow(c.campaignId)}
                          disabled={runningId === c.campaignId}
                          className="text-[13px] font-bold text-[var(--primary)] hover:text-[var(--red)] disabled:opacity-50"
                        >
                          {runningId === c.campaignId ? "Running…" : "Run now"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
