"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

function formatFieldLabel(key: string) {
  if (key === "spend" || key === "Spend") return "Spend Range";
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isImageUrl(value: string) {
  return /^https?:\/\//i.test(value) && /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(value);
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/** ISO timestamps → put a space after the date (2026-03-30T07:00:00.000Z → 2026-03-30 07:00:00.000Z). */
function formatIsoTimestampDisplay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  return value.replace("T", " ");
}

function isDateFieldKey(key?: string) {
  if (!key) return false;
  return /(^|_)(date|time|at|timestamp|start|end|seen|created|updated|delivery)(_|$)/i.test(
    key.replace(/([a-z])([A-Z])/g, "$1_$2")
  );
}

/** Meta often sends start_date as unix seconds (e.g. 1774854000). */
function formatUnixTimestampDisplay(value: number): string | null {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  // Seconds (~2001–2603) or milliseconds
  const ms =
    value >= 1_000_000_000 && value <= 20_000_000_000
      ? value * 1000
      : value >= 1_000_000_000_000 && value <= 20_000_000_000_000
        ? value
        : null;
  if (ms == null) return null;
  const iso = new Date(ms).toISOString();
  return formatIsoTimestampDisplay(iso) ?? iso.replace("T", " ");
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ActorValue({
  value,
  depth,
  fieldKey,
}: {
  value: unknown;
  depth: number;
  fieldKey?: string;
}) {
  if (value === null || value === undefined) {
    return <span style={{ color: "#9FA8A3" }}>—</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>;
  }

  if (typeof value === "number") {
    if (isDateFieldKey(fieldKey)) {
      const unixDisplay = formatUnixTimestampDisplay(value);
      if (unixDisplay) {
        return <span style={{ fontSize: 13, lineHeight: 1.5 }}>{unixDisplay}</span>;
      }
    }
    return <span>{Number.isFinite(value) ? value.toLocaleString() : String(value)}</span>;
  }

  if (typeof value === "string") {
    const isoDisplay = formatIsoTimestampDisplay(value.trim());
    if (isoDisplay) {
      return <span style={{ fontSize: 13, lineHeight: 1.5 }}>{isoDisplay}</span>;
    }
    if (isDateFieldKey(fieldKey) && /^\d{9,13}$/.test(value.trim())) {
      const unixDisplay = formatUnixTimestampDisplay(Number(value.trim()));
      if (unixDisplay) {
        return <span style={{ fontSize: 13, lineHeight: 1.5 }}>{unixDisplay}</span>;
      }
    }
    const text = value.includes("<") && value.includes(">") ? stripHtml(value) : value;
    if (isImageUrl(text)) {
      return (
        <a href={text} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={text}
            alt=""
            referrerPolicy="no-referrer"
            style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1px solid #E8DCC2" }}
          />
        </a>
      );
    }
    if (isHttpUrl(text)) {
      return (
        <a href={text} target="_blank" rel="noopener noreferrer" style={{ color: "#669BBC", wordBreak: "break-all" }}>
          {text} <ExternalLink size={12} style={{ verticalAlign: "middle" }} />
        </a>
      );
    }
    return (
      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.5 }}>{text}</span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span style={{ color: "#9FA8A3" }}>Empty list</span>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {value.map((item, index) => (
          <div
            key={index}
            style={{
              borderLeft: "2px solid #E8DCC2",
              paddingLeft: 12,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9FA8A3", marginBottom: 4, letterSpacing: "0.06em" }}>
              [{index + 1}]
            </div>
            <ActorValue value={item} depth={depth + 1} fieldKey={fieldKey} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return <ActorObject obj={value as Record<string, unknown>} depth={depth + 1} />;
  }

  return <span>{String(value)}</span>;
}

const HIDDEN_PAYLOAD_KEYS = new Set([
  "start_date_formatted",
  "startDateFormatted",
]);

function ActorObject({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const keys = Object.keys(obj)
    .filter((key) => !HIDDEN_PAYLOAD_KEYS.has(key))
    .sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) {
    return <span style={{ color: "#9FA8A3" }}>Empty object</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: depth <= 1 ? 14 : 10 }}>
      {keys.map((key) => (
        <div key={key}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: depth <= 1 ? "#C1121F" : "#9FA8A3",
              marginBottom: 4,
            }}
          >
            {formatFieldLabel(key)}
          </div>
          <div style={{ paddingLeft: depth > 2 ? 8 : 0 }}>
            <ActorValue value={obj[key]} depth={depth} fieldKey={key} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActorPayloadDetails({ payload }: { payload: unknown }) {
  if (payload === null || payload === undefined) {
    return (
      <p style={{ fontSize: 13, color: "#8C8474", margin: 0 }}>
        No actor payload stored for this ad. Re-run competitor analysis to capture the full scrape.
      </p>
    );
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    return <ActorValue value={payload} depth={0} />;
  }

  return <ActorObject obj={payload as Record<string, unknown>} depth={0} />;
}
