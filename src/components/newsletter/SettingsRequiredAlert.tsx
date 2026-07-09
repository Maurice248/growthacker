"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { clientWorkspaceHref } from "@/lib/client-dashboard-nav";

export type SettingsField =
  | "fromEmail"
  | "fromName"
  | "replyTo"
  | "website"
  | "logoUrl"
  | "addressLine"
  | "phone"
  | "unsubscribeBaseUrl";

const FIELD_LABELS: Record<SettingsField, string> = {
  fromEmail: "From Email",
  fromName: "From Name",
  replyTo: "Reply-To",
  website: "Website",
  logoUrl: "Logo URL",
  addressLine: "Address",
  phone: "Phone",
  unsubscribeBaseUrl: "Unsubscribe Base URL",
};

type Props = {
  /** Fields this feature needs from Newsletter Settings */
  required: SettingsField[];
  className?: string;
};

/** Fields needed to generate / authorize newsletter HTML templates */
export const GENERATE_REQUIRED_SETTINGS: SettingsField[] = [
  "fromEmail",
  "website",
  "logoUrl",
  "unsubscribeBaseUrl",
];

/** Fields needed to create and send campaigns */
export const CAMPAIGN_REQUIRED_SETTINGS: SettingsField[] = [
  "fromEmail",
  "fromName",
  "unsubscribeBaseUrl",
];

export default function SettingsRequiredAlert({ required, className = "" }: Props) {
  const pathname = usePathname();
  const [missing, setMissing] = useState<SettingsField[] | null>(null);
  const requiredKey = required.join(",");
  const settingsHref = pathname?.startsWith("/client-dashboard")
    ? clientWorkspaceHref("newsletter-overview")
    : "/newsletter/overview";

  useEffect(() => {
    const fields = requiredKey.split(",") as SettingsField[];
    let cancelled = false;
    fetch("/api/newsletter/config")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || json.error) return;
        // Only count values saved in Newsletter Settings — not inferred context defaults
        const cfg = json.config as Record<string, unknown> | null;
        const valueOf = (key: SettingsField) =>
          cfg ? String(cfg[key] ?? "").trim() : "";
        const absent = fields.filter((key) => !valueOf(key));
        setMissing(absent);
      })
      .catch(() => {
        if (!cancelled) setMissing(fields);
      });
    return () => {
      cancelled = true;
    };
  }, [requiredKey]);

  if (!missing || missing.length === 0) return null;

  const labels = missing.map((k) => FIELD_LABELS[k]).join(", ");

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Newsletter Settings incomplete</p>
        <p className="mt-1 text-amber-800">
          Configure <span className="font-semibold">{labels}</span> in{" "}
          <Link href={settingsHref} className="font-semibold underline underline-offset-2 hover:text-amber-950">
            Newsletter Settings
          </Link>{" "}
          before using this feature.
        </p>
      </div>
    </div>
  );
}
