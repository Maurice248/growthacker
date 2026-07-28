"use client";

import { useEffect, useState } from "react";
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialPillButton,
} from "@/app/components";
import {
  EditorialPageHeader,
  EditorialSectionHeader,
} from "@/components/editorial/editorial-layout";
import { OutreachMetricInput } from "@/components/cold-email/outreach-ui";
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
    return <div className="nl-root py-16 text-center text-[#8C8474]">Loading newsletter settings…</div>;
  }

  return (
    <div className="nl-root">
      <EditorialPageHeader
        eyebrow="Newsletter"
        title="Newsletter Settings"
        subtitle={
          companyName
            ? `Configure sending identity and schedule for ${companyName}. AI prompts use your Brand and ICP automatically.`
            : "Configure sending identity and schedule. AI prompts use your Brand and ICP automatically."
        }
      />

      <section className="mt-10">
        <EditorialSectionHeader title="Sending Identity" />
        <EditorialDefinitionList>
          <EditorialDefinitionRow label="From">
            <div className="flex flex-wrap gap-8">
              <EditorialField value={form.fromEmail} onChange={(v) => update("fromEmail", v)} />
              <EditorialField value={form.fromName} onChange={(v) => update("fromName", v)} />
            </div>
          </EditorialDefinitionRow>
          <EditorialDefinitionRow label="Reply-to & website">
            <div className="flex flex-wrap gap-8">
              <EditorialField
                value={form.replyTo}
                onChange={(v) => update("replyTo", v)}
                placeholder="reply-to@…"
              />
              <EditorialField value={form.website} onChange={(v) => update("website", v)} />
            </div>
          </EditorialDefinitionRow>
          <EditorialDefinitionRow label="Logo URL & phone">
            <div className="flex flex-wrap gap-8">
              <EditorialField value={form.logoUrl} onChange={(v) => update("logoUrl", v)} />
              <EditorialField
                value={form.phone}
                onChange={(v) => update("phone", v)}
                placeholder="Phone"
              />
            </div>
          </EditorialDefinitionRow>
          <EditorialDefinitionRow label="Address">
            <EditorialField
              value={form.addressLine}
              onChange={(v) => update("addressLine", v)}
              placeholder="Mailing address for the footer"
            />
          </EditorialDefinitionRow>
          <EditorialDefinitionRow
            label="Unsubscribe URL"
            labelSub="Points to /api/newsletter/unsubscribe"
            isLast
          >
            <EditorialField
              value={form.unsubscribeBaseUrl}
              onChange={(v) => update("unsubscribeBaseUrl", v)}
            />
          </EditorialDefinitionRow>
        </EditorialDefinitionList>
      </section>

      <section className="mt-11">
        <EditorialSectionHeader title="Schedule" />
        <div
          className="grid border-b border-[var(--border)]"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          <div className="border-r border-[var(--border)] py-6 pr-6">
            <div className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Timezone
            </div>
            <TimezoneSelect
              value={form.sendTimezone}
              onChange={(v) => update("sendTimezone", v)}
              className="nl-select w-full appearance-none border-b border-[#C2B79A] bg-transparent py-2 text-sm font-bold text-[var(--primary)] outline-none focus:border-[var(--red)]"
            />
          </div>
          <div className="border-r border-[var(--border)] px-6 py-6">
            <div className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Send hour
            </div>
            <OutreachMetricInput
              value={String(form.sendHour)}
              onChange={(v) => update("sendHour", Number(v))}
              min={0}
              max={23}
            />
          </div>
          <div className="border-r border-[var(--border)] px-6 py-6">
            <div className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Send minute
            </div>
            <OutreachMetricInput
              value={String(form.sendMinute)}
              onChange={(v) => update("sendMinute", Number(v))}
              min={0}
              max={59}
            />
          </div>
          <div className="py-6 pl-6">
            <div className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Daily limit
            </div>
            <OutreachMetricInput
              value={String(form.dailyLimit)}
              onChange={(v) => update("dailyLimit", Number(v))}
              min={1}
              width="md"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-4 pt-5">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update("active", e.target.checked)}
              className="h-[15px] w-[15px] accent-[var(--red)]"
            />
            Enable automated newsletter sending
          </label>
          <EditorialPillButton variant="danger" disabled={saving} onClick={handleSave} style={{ marginLeft: "auto", padding: "10px 24px", whiteSpace: "nowrap" }}>
            {saving ? "Saving…" : "Save settings"}
          </EditorialPillButton>
        </div>

        {message && (
          <p className={`mt-4 text-sm ${message.includes("saved") ? "text-[#4A5A64]" : "text-[#C1121F]"}`}>
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
