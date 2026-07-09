"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import TimezoneSelect from "./TimezoneSelect";
import "./newsletter.css";

type ConfigForm = {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  website: string;
  logoUrl: string;
  addressLine: string;
  phone: string;
  unsubscribeBaseUrl: string;
  sendHour: number;
  sendMinute: number;
  sendTimezone: string;
  dailyLimit: number;
  active: boolean;
};

const EMPTY: ConfigForm = {
  fromEmail: "",
  fromName: "",
  replyTo: "",
  website: "",
  logoUrl: "",
  addressLine: "",
  phone: "",
  unsubscribeBaseUrl: "",
  sendHour: 10,
  sendMinute: 30,
  sendTimezone: "America/Toronto",
  dailyLimit: 50,
  active: true,
};

export default function NewsletterOverview() {
  const [form, setForm] = useState<ConfigForm>(EMPTY);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/newsletter/config")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setMessage(json.error);
          return;
        }
        const cfg = json.config || {};
        const ctx = json.context || {};
        setCompanyName(ctx.companyName || "");
        setForm({
          fromEmail: cfg.fromEmail ?? ctx.fromEmail ?? "",
          fromName: cfg.fromName ?? ctx.fromName ?? "",
          replyTo: cfg.replyTo ?? ctx.replyTo ?? "",
          website: cfg.website ?? ctx.website ?? "",
          logoUrl: cfg.logoUrl ?? ctx.logoUrl ?? "",
          addressLine: cfg.addressLine ?? ctx.addressLine ?? "",
          phone: cfg.phone ?? ctx.phone ?? "",
          unsubscribeBaseUrl: cfg.unsubscribeBaseUrl ?? ctx.unsubscribeBaseUrl ?? "",
          sendHour: cfg.sendHour ?? ctx.sendHour ?? 10,
          sendMinute: cfg.sendMinute ?? ctx.sendMinute ?? 30,
          sendTimezone: cfg.sendTimezone ?? ctx.sendTimezone ?? "America/Toronto",
          dailyLimit: cfg.dailyLimit ?? ctx.dailyLimit ?? 50,
          active: cfg.active ?? ctx.active ?? true,
        });
      })
      .catch(() => setMessage("Failed to load newsletter settings"))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof ConfigForm, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage("Settings saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="nl-root py-16 text-center text-gray-500">Loading newsletter settings...</div>;
  }

  return (
    <div className="nl-root">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Newsletter Settings</h1>
          <p className="mt-1 text-gray-500">
            Configure sending identity and schedule for <span className="font-medium">{companyName}</span>. AI prompts
            use your Brand Context automatically.
          </p>
        </div>

        <div className="nl-panel nl-panel-body flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="From Email" value={form.fromEmail} onChange={(v) => update("fromEmail", v)} />
            <Field label="From Name" value={form.fromName} onChange={(v) => update("fromName", v)} />
            <Field label="Reply-To" value={form.replyTo} onChange={(v) => update("replyTo", v)} />
            <Field label="Website" value={form.website} onChange={(v) => update("website", v)} />
            <Field label="Logo URL" value={form.logoUrl} onChange={(v) => update("logoUrl", v)} />
            <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
          </div>

          <Field label="Address" value={form.addressLine} onChange={(v) => update("addressLine", v)} />
          <Field
            label="Unsubscribe Base URL"
            value={form.unsubscribeBaseUrl}
            onChange={(v) => update("unsubscribeBaseUrl", v)}
            hint="Should point to /api/newsletter/unsubscribe on your app domain"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="nl-label">Timezone</label>
              <TimezoneSelect value={form.sendTimezone} onChange={(v) => update("sendTimezone", v)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field
              label="Send Hour"
              value={String(form.sendHour)}
              onChange={(v) => update("sendHour", Number(v) || 0)}
              type="number"
              hint="Local time in selected timezone"
            />
            <Field
              label="Send Minute"
              value={String(form.sendMinute)}
              onChange={(v) => update("sendMinute", Number(v) || 0)}
              type="number"
              hint="Local time in selected timezone"
            />
            <Field
              label="Default Daily Limit"
              value={String(form.dailyLimit)}
              onChange={(v) => update("dailyLimit", Number(v) || 50)}
              type="number"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            Enable automated newsletter sending
          </label>

          <button onClick={handleSave} disabled={saving} className="nl-btn-primary w-full">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </button>

          {message && <p className="text-sm text-gray-600 text-center">{message}</p>}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="nl-label">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="nl-input" />
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
