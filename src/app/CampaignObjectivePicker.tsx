"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Megaphone,
  MousePointer2,
  MessagesSquare,
  Filter,
  Users,
  ShoppingBag,
  X,
} from "lucide-react";

type ObjectiveValue =
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_APP_PROMOTION"
  | "OUTCOME_SALES";

type ObjectiveMeta = {
  value: ObjectiveValue;
  label: string;
  description: string;
  aboutHref?: string;
  aboutLabel?: string;
  goodFor: string[];
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

export const CAMPAIGN_OBJECTIVE_OPTIONS: ObjectiveMeta[] = [
  {
    value: "OUTCOME_AWARENESS",
    label: "Awareness",
    description: "Show your ads to people who are most likely to remember them.",
    goodFor: ["Reach", "Brand awareness", "Video views"],
    Icon: Megaphone,
  },
  {
    value: "OUTCOME_TRAFFIC",
    label: "Traffic",
    description: "Send people to a destination, like your website, app, Instagram profile, Facebook page or Facebook event.",
    aboutHref: "https://www.facebook.com/business/help/146298401405243",
    aboutLabel: "About traffic",
    goodFor: [
      "Link clicks",
      "Landing page views",
      "Facebook page visits",
      "Instagram profile visits",
      "Messenger, Instagram and WhatsApp",
      "Calls",
    ],
    Icon: MousePointer2,
  },
  {
    value: "OUTCOME_ENGAGEMENT",
    label: "Engagement",
    description: "Get more messages, purchases through messaging, video views, interactions, Page likes or event responses.",
    goodFor: [
      "Messenger, Instagram and WhatsApp",
      "Video views",
      "Interactions",
      "Conversions",
      "Calls",
    ],
    Icon: MessagesSquare,
  },
  {
    value: "OUTCOME_LEADS",
    label: "Leads",
    description: "Collect leads for your business or brand.",
    goodFor: [
      "Website and instant forms",
      "Instant forms",
      "Messenger, Instagram and WhatsApp",
      "Conversions",
      "Calls",
    ],
    Icon: Filter,
  },
  {
    value: "OUTCOME_APP_PROMOTION",
    label: "App promotion",
    description: "Find new people to install your app and continue using it.",
    aboutHref: "https://www.facebook.com/business/help/1550142205275292",
    aboutLabel: "About app promotion",
    goodFor: ["App installs", "App events"],
    Icon: Users,
  },
  {
    value: "OUTCOME_SALES",
    label: "Sales",
    description: "Find people likely to purchase your product or service.",
    goodFor: [
      "Conversions",
      "Catalog sales",
      "Messenger, Instagram and WhatsApp",
      "Calls",
    ],
    Icon: ShoppingBag,
  },
];

const BLUE = "#1877F2";
const TEXT = "#1C2B33";
const MUTED = "#65676B";

function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: selected ? `6px solid ${BLUE}` : "2px solid #8A8D91",
        background: selected ? "#fff" : "transparent",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#F0F2F5",
        color: TEXT,
        fontSize: 13,
        lineHeight: "18px",
        padding: "6px 12px",
        borderRadius: 8,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

function IllustrationFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 280,
        height: 168,
        margin: "0 auto 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function InitialIllustration() {
  return (
    <IllustrationFrame>
      <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
        <rect x="28" y="22" width="184" height="118" rx="10" fill="#E8F3FC" stroke="#B9D7F2" strokeWidth="2" />
        <path d="M48 88C72 70 92 54 118 72C144 90 164 108 196 86" stroke="#4EA3E0" strokeWidth="2.5" strokeDasharray="6 6" fill="none" />
        <circle cx="64" cy="78" r="7" fill="#1877F2" />
        <path d="M64 78L64 98" stroke="#1877F2" strokeWidth="3" />
        <circle cx="176" cy="92" r="7" fill="#42B72A" />
        <path d="M176 92L176 112" stroke="#42B72A" strokeWidth="3" />
        <circle cx="186" cy="42" r="16" fill="#fff" stroke="#C5D4E0" strokeWidth="2" />
        <polygon points="186,30 190,42 186,54 182,42" fill="#1877F2" />
        <polygon points="174,42 186,38 198,42 186,46" fill="#42B72A" />
      </svg>
    </IllustrationFrame>
  );
}

function AwarenessIllustration() {
  return (
    <IllustrationFrame>
      <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
        <circle cx="168" cy="48" r="22" fill="#BFE3F7" />
        <circle cx="196" cy="84" r="18" fill="#7EC8EA" />
        <circle cx="172" cy="116" r="16" fill="#4AA8D8" />
        <circle cx="168" cy="48" r="10" fill="#fff" />
        <circle cx="196" cy="84" r="8" fill="#fff" />
        <circle cx="172" cy="116" r="7" fill="#fff" />
        <path d="M38 92c0-18 14-32 32-32h18v64H70c-18 0-32-14-32-32z" fill="#1877F2" />
        <rect x="88" y="52" width="28" height="80" rx="6" fill="#0B5FCC" />
        <path d="M116 64l36-22v76l-36-22V64z" fill="#31A4FF" />
      </svg>
    </IllustrationFrame>
  );
}

function TrafficIllustration() {
  return (
    <IllustrationFrame>
      <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
        <rect x="36" y="28" width="150" height="100" rx="10" fill="#E7F0FF" stroke="#C5D8F6" strokeWidth="2" />
        <rect x="36" y="28" width="150" height="22" rx="10" fill="#D6E6FB" />
        <circle cx="50" cy="39" r="4" fill="#FF6B6B" />
        <circle cx="62" cy="39" r="4" fill="#FFD93D" />
        <circle cx="74" cy="39" r="4" fill="#6BCB77" />
        <rect x="52" y="66" width="88" height="10" rx="5" fill="#B7D0F5" />
        <rect x="52" y="84" width="64" height="10" rx="5" fill="#C9DCF8" />
        <path d="M150 96l22 8-8 6 14 18-10 6-14-18-8 8-6-22 10-6z" fill="#1877F2" />
        <path d="M118 118l16 6-6 5 10 14-8 5-10-14-6 6-4-16 8-6z" fill="#31A4FF" />
      </svg>
    </IllustrationFrame>
  );
}

function EngagementIllustration() {
  return (
    <IllustrationFrame>
      <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
        <rect x="28" y="36" width="70" height="52" rx="14" fill="#4B9FE8" />
        <polygon points="52,52 72,62 52,72" fill="#fff" />
        <rect x="108" y="24" width="56" height="56" rx="16" fill="#7B8CFF" />
        <path d="M136 42c-6 0-10 4-10 10 0 12 10 18 10 18s10-6 10-18c0-6-4-10-10-10z" fill="#fff" />
        <rect x="168" y="54" width="52" height="52" rx="16" fill="#5AC8FA" />
        <path d="M184 80h24M196 68v24" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        <rect x="48" y="96" width="64" height="44" rx="14" fill="#2D88FF" />
        <path d="M68 118h8l6 8 6-8h8" stroke="#fff" strokeWidth="3" fill="none" strokeLinejoin="round" />
        <rect x="122" y="102" width="50" height="40" rx="12" fill="#F48FB1" />
        <path d="M136 124h22v-8c0-6-5-10-11-10s-11 4-11 10v8z" fill="#fff" />
      </svg>
    </IllustrationFrame>
  );
}

function LeadsIllustration() {
  return (
    <IllustrationFrame>
      <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
        <rect x="86" y="28" width="92" height="108" rx="12" fill="#D7E3F4" transform="rotate(8 132 82)" />
        <rect x="70" y="32" width="92" height="108" rx="12" fill="#F4B183" />
        <circle cx="116" cy="78" r="20" fill="#fff" />
        <circle cx="116" cy="74" r="8" fill="#E07A3D" />
        <path d="M100 98c4-10 28-10 32 0" stroke="#E07A3D" strokeWidth="4" fill="none" />
        <circle cx="158" cy="40" r="16" fill="#1877F2" />
        <path d="M151 40l5 5 10-11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IllustrationFrame>
  );
}

function AppPromotionIllustration() {
  return (
    <IllustrationFrame>
      <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
        <rect x="78" y="16" width="84" height="128" rx="18" fill="#6C63FF" />
        <rect x="86" y="28" width="68" height="96" rx="8" fill="#EEF2FF" />
        <circle cx="120" cy="132" r="5" fill="#EEF2FF" />
        <rect x="102" y="54" width="36" height="36" rx="10" fill="#1877F2" />
        <path d="M120 64v16M112 74h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M120 48v-10" stroke="#1877F2" strokeWidth="3" />
        <path d="M112 44l8 8 8-8" stroke="#1877F2" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    </IllustrationFrame>
  );
}

function SalesIllustration() {
  return (
    <IllustrationFrame>
      <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
        <rect x="36" y="48" width="54" height="54" rx="14" fill="#3DDC97" />
        <path d="M48 76h30M63 62v28" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <rect x="98" y="28" width="58" height="58" rx="16" fill="#4FC3F7" />
        <path d="M116 68c8-16 24-16 24 0v8H116v-8z" fill="#fff" />
        <rect x="168" y="44" width="48" height="62" rx="8" fill="#FFB74D" transform="rotate(12 192 75)" />
        <circle cx="186" cy="58" r="5" fill="#fff" />
        <rect x="118" y="100" width="70" height="36" rx="10" fill="#1877F2" />
        <path d="M130 118h46M130 110h10v16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </IllustrationFrame>
  );
}

function ObjectiveIllustration({ value }: { value: ObjectiveValue | null }) {
  switch (value) {
    case "OUTCOME_AWARENESS":
      return <AwarenessIllustration />;
    case "OUTCOME_TRAFFIC":
      return <TrafficIllustration />;
    case "OUTCOME_ENGAGEMENT":
      return <EngagementIllustration />;
    case "OUTCOME_LEADS":
      return <LeadsIllustration />;
    case "OUTCOME_APP_PROMOTION":
      return <AppPromotionIllustration />;
    case "OUTCOME_SALES":
      return <SalesIllustration />;
    default:
      return <InitialIllustration />;
  }
}

interface CampaignObjectivePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CampaignObjectivePicker({ value, onChange }: CampaignObjectivePickerProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<ObjectiveValue | null>(null);
  const [draft, setDraft] = useState<ObjectiveValue | null>(null);

  const selectedMeta = CAMPAIGN_OBJECTIVE_OPTIONS.find((o) => o.value === value);
  const previewValue = hovered || draft;
  const previewMeta = CAMPAIGN_OBJECTIVE_OPTIONS.find((o) => o.value === previewValue);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openModal = () => {
    setHovered(null);
    const current = CAMPAIGN_OBJECTIVE_OPTIONS.some((o) => o.value === value)
      ? (value as ObjectiveValue)
      : null;
    setDraft(current);
    setOpen(true);
  };

  const TriggerIcon = selectedMeta?.Icon || MousePointer2;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        style={{
          width: "100%",
          padding: "10px 32px 10px 14px",
          borderRadius: 10,
          border: open ? "1.5px solid #669BBC" : "1.5px solid #E8DCC2",
          background: open ? "#fff" : "#FDF6E3",
          color: "#003049",
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: open ? "0 0 0 3px rgba(0,48,73,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
          <TriggerIcon size={16} color="#1877F2" strokeWidth={2.2} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedMeta?.label || "Choose an objective"}
          </span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9FA8A3"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginLeft: 6 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-objective-title"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0, 0, 0, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 860,
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
                padding: "28px 28px 32px",
                position: "relative",
                fontFamily: "inherit",
              }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: MUTED,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                }}
              >
                <X size={18} />
              </button>

              <h2
                id="campaign-objective-title"
                style={{
                  margin: "0 0 20px",
                  fontSize: 22,
                  fontWeight: 700,
                  color: TEXT,
                  letterSpacing: "-0.02em",
                }}
              >
                Choose a campaign objective
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 28, minHeight: 420 }}>
                <div onMouseLeave={() => setHovered(null)}>
                  {CAMPAIGN_OBJECTIVE_OPTIONS.map((obj) => {
                    const selected = draft === obj.value;
                    const Icon = obj.Icon;
                    return (
                      <button
                        key={obj.value}
                        type="button"
                        onMouseEnter={() => setHovered(obj.value)}
                        onClick={() => {
                          setDraft(obj.value);
                          onChange(obj.value);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          marginBottom: 4,
                          border: "none",
                          borderRadius: 8,
                          background: selected ? "#E7F3FF" : hovered === obj.value ? "#F2F4F7" : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                        }}
                      >
                        <Radio selected={selected} />
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: selected ? BLUE : "#F0F2F5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={18} color={selected ? "#fff" : TEXT} strokeWidth={2} />
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{obj.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: previewMeta ? "flex-start" : "center",
                    padding: "8px 8px 0 12px",
                  }}
                >
                  <ObjectiveIllustration value={previewValue} />
                  {previewMeta ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
                        {previewMeta.label}
                      </div>
                      <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55, color: MUTED, maxWidth: 420 }}>
                        {previewMeta.description}{" "}
                        {previewMeta.aboutHref && (
                          <a
                            href={previewMeta.aboutHref}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: BLUE, textDecoration: "none", fontWeight: 600 }}
                          >
                            {previewMeta.aboutLabel}
                          </a>
                        )}
                      </p>
                      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Good for:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {previewMeta.goodFor.map((tag) => (
                          <Pill key={tag}>{tag}</Pill>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: MUTED,
                        textAlign: "center",
                        maxWidth: 360,
                        alignSelf: "center",
                      }}
                    >
                      Your campaign objective is the business goal you hope to achieve by running your ads. Hover over
                      each one for more information.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
