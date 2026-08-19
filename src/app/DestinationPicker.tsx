"use client";

import React from "react";
import { Link2, MessagesSquare } from "lucide-react";

export type DestinationValue = "WEBSITE" | "MESSAGING";
export type MessagingAppId = "MESSENGER" | "INSTAGRAM" | "WHATSAPP";

const BLUE = "#1877F2";
const TEXT = "#1C2B33";
const MUTED = "#65676B";
const NAVY = "#003049";

const DESTINATIONS: Array<{
  value: DestinationValue;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}> = [
  { value: "WEBSITE", label: "Website", Icon: Link2 },
  { value: "MESSAGING", label: "Messaging apps", Icon: MessagesSquare },
];

export const MESSAGING_APPS: Array<{ id: MessagingAppId; label: string; hint: string }> = [
  { id: "MESSENGER", label: "Messenger", hint: "Uses your connected Facebook Page" },
  { id: "INSTAGRAM", label: "Instagram", hint: "Uses your connected Instagram account" },
  { id: "WHATSAPP", label: "WhatsApp", hint: "Uses your connected WhatsApp number" },
];

function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: selected ? `5px solid ${NAVY}` : "1.5px solid #C2B79A",
        background: selected ? "#fff" : "transparent",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    />
  );
}

function Check({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        border: checked ? "none" : "2px solid #8A8D91",
        background: checked ? BLUE : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

function AppAvatar({ app }: { app: MessagingAppId }) {
  const bg = app === "MESSENGER" ? "#0084FF" : app === "INSTAGRAM" ? "linear-gradient(135deg, #F58529, #DD2A7B 50%, #8134AF)" : "#25D366";
  return (
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {app === "MESSENGER" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.2 1.9.4 2.9.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2zm1 12.5-2.6-2.8-5 2.8L12 8.7l2.7 2.8 4.9-2.8-6.6 5.8z" />
        </svg>
      )}
      {app === "INSTAGRAM" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none" />
        </svg>
      )}
      {app === "WHATSAPP" && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 2a10 10 0 00-8.7 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm5.7 14.2c-.2.7-1.3 1.2-1.8 1.3-.5.1-1 .2-1.7-.1-.4-.2-.9-.4-1.6-.8-2.8-1.5-4.6-4.3-4.8-4.5-.1-.2-1.2-1.6-1.2-3s.8-2.1.9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .5.4.2.5.6 1.6.7 1.7.1.1.1.3 0 .4l-.3.4c-.1.1-.2.3-.1.5.1.2.5 1 .9 1.5.7.8 1.3 1.1 1.5 1.2.2.1.4.1.5 0l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.5 0 .2 0 1.1-.2 1.8z" />
        </svg>
      )}
    </span>
  );
}

export function MessagingAppsPanel({
  messagingApps,
  onMessagingAppsChange,
  whatsappNumber = "",
  onWhatsappNumberChange,
}: {
  messagingApps: string[];
  onMessagingAppsChange: (apps: MessagingAppId[]) => void;
  whatsappNumber?: string;
  onWhatsappNumberChange?: (value: string) => void;
}) {
  const selectedApps = new Set(messagingApps);
  const toggleApp = (id: MessagingAppId) => {
    const next = selectedApps.has(id)
      ? messagingApps.filter((app) => app !== id)
      : [...messagingApps, id];
    if (next.length === 0) return;
    onMessagingAppsChange(next as MessagingAppId[]);
  };

  return (
    <div
      style={{
        marginTop: 8,
        padding: "16px 20px 12px",
        background: "#E7F0F6",
        borderRadius: 12,
        border: "1px solid #C2D6E2",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1A4A66", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        Messaging apps
      </div>
      {MESSAGING_APPS.map((app) => {
        const checked = selectedApps.has(app.id);
        return (
          <div key={app.id}>
            <button
              type="button"
              onClick={() => toggleApp(app.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <Check checked={checked} />
              <AppAvatar app={app.id} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: TEXT }}>{app.label}</span>
                <span style={{ display: "block", fontSize: 12.5, color: MUTED, marginTop: 1 }}>{app.hint}</span>
              </span>
            </button>
            {app.id === "WHATSAPP" && checked && (
              <input
                value={whatsappNumber}
                onChange={(e) => onWhatsappNumberChange?.(e.target.value)}
                placeholder="+1 555 555 5555"
                style={{
                  margin: "0 0 10px 66px",
                  width: "calc(100% - 66px)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #C2D6E2",
                  background: "#fff",
                  fontSize: 13,
                  fontFamily: "inherit",
                  color: TEXT,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DestinationPickerProps {
  value: string;
  onChange: (value: DestinationValue) => void;
}

export default function DestinationPicker({ value, onChange }: DestinationPickerProps) {
  return (
    <div role="radiogroup" aria-label="Destination" style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      {DESTINATIONS.map((dest) => {
        const selected = value === dest.value;
        const Icon = dest.Icon;
        return (
          <button
            key={dest.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(dest.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              color: selected ? NAVY : "#4A5A64",
            }}
          >
            <Radio selected={selected} />
            <Icon size={16} color={selected ? NAVY : "#8C8474"} strokeWidth={2.2} />
            <span style={{ fontSize: 15, fontWeight: selected ? 700 : 500 }}>{dest.label}</span>
          </button>
        );
      })}
    </div>
  );
}
