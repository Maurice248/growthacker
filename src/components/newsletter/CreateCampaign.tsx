"use client";

import { useEffect, useState } from "react";
import { useCampaigns, Campaign } from "@/context/CampaignContext";
import TimezoneSelect from "./TimezoneSelect";
import { formatTimezoneLabel } from "@/lib/newsletter/timezones";
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

  const canSubmit =
    templateId.trim() && campaignName.trim() && subscribers && dailyLimit !== "";

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
      <SettingsRequiredAlert required={CAMPAIGN_REQUIRED_SETTINGS} className="mb-4" />
      <div className="nl-grid nl-grid-2">
        <div className="nl-panel nl-panel-body flex flex-col gap-5">
          <div className="space-y-2">
            <label className="nl-label">Template <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="nl-select appearance-none pr-10"
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
            </div>
            {templates.length === 0 && (
              <p className="text-xs text-gray-500">Generate and authorize a newsletter first to create templates.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="nl-label">Campaign Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Weekly Tenant Screening Update..."
              className="nl-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="nl-label">Subscribers <span className="text-red-500">*</span></label>
              <select
                value={subscribers}
                onChange={(e) => setSubscribers(e.target.value)}
                className="nl-select appearance-none pr-10"
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

            <div className="space-y-2">
              <label className="nl-label">Daily Limit <span className="text-red-500">*</span></label>
              <select
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="nl-select appearance-none pr-10"
              >
                <option value="" disabled>
                  Select limit
                </option>
                {DAILY_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} emails / day
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="nl-label">Timezone</label>
            <TimezoneSelect value={sendTimezone} onChange={setSendTimezone} />
            <p className="text-xs text-gray-500">{formatTimezoneLabel(sendTimezone)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="nl-label">Send Hour</label>
              <input
                type="number"
                min={0}
                max={23}
                value={sendHour}
                onChange={(e) => setSendHour(Number(e.target.value))}
                className="nl-input"
              />
            </div>
            <div className="space-y-2">
              <label className="nl-label">Send Minute</label>
              <input
                type="number"
                min={0}
                max={59}
                value={sendMinute}
                onChange={(e) => setSendMinute(Number(e.target.value))}
                className="nl-input"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Local time in the selected timezone</p>

          <button
            onClick={handleCreate}
            disabled={!canSubmit || status === "loading"}
            className="nl-btn-primary mt-1"
          >
            {status === "loading" ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                Launching...
              </>
            ) : (
              <>
                <span>🚀</span> Launch Campaign
              </>
            )}
          </button>

          {status === "success" && (
            <div className="nl-alert-success border-l-4 border-l-green-600 rounded-r-xl mt-1">
              <p className="text-base font-black text-green-900">MISSION SUCCESS</p>
              {lastCampaignId && (
                <div className="bg-white border border-green-200 rounded-lg p-3 flex items-center justify-between gap-3 mt-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1">Campaign ID</p>
                    <p className="text-sm font-mono font-bold text-gray-900 truncate">{lastCampaignId}</p>
                  </div>
                  <button
                    onClick={() => handleCopyId(lastCampaignId)}
                    className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs font-black text-green-700"
                  >
                    {copiedId === lastCampaignId ? "COPIED" : "COPY"}
                  </button>
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="nl-alert-error border-l-4 border-l-red-600 rounded-r-xl mt-1">
              <p className="text-sm font-medium text-red-700">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="nl-panel flex flex-col min-h-[480px] overflow-hidden">
          <div className="nl-panel-header">
            <div className="flex items-center gap-3">
              <h3 className="nl-panel-title">Command History</h3>
              <span className="nl-count-badge">{history.length}</span>
            </div>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-xs font-black uppercase text-gray-400 hover:text-red-600">
                Wipe Logs
              </button>
            )}
          </div>

          <div className="flex-1 p-5 overflow-y-auto">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 py-16">
                <p className="text-sm font-black uppercase tracking-widest">No Data Logs Found</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((c) => (
                  <div
                    key={c.campaignId || c.createdAt}
                    className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition-shadow hover:border-indigo-100 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                          />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          {formatDate(c.createdAt)}
                        </p>
                        <h4 className="mt-0.5 truncate text-sm font-bold text-gray-900">{c.campaignName}</h4>

                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            {c.subscribers === "All Subscribers"
                              ? "All subscribers"
                              : `${c.subscribers} subscribers`}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                            {c.dailyLimit}/day
                          </span>
                        </div>

                        {c.campaignId && (
                          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                                Campaign ID
                              </p>
                              <code className="mt-0.5 block truncate font-mono text-[11px] text-gray-500">
                                {c.campaignId}
                              </code>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyId(c.campaignId)}
                              className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 hover:border-gray-300 hover:text-gray-900"
                            >
                              {copiedId === c.campaignId ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRunNow(c.campaignId)}
                              disabled={runningId === c.campaignId}
                              className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                              {runningId === c.campaignId ? "Running..." : "Run Now"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
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
