"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Megaphone,
  MousePointer2,
  MessagesSquare,
  Filter,
  Users,
  ShoppingBag,
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
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
    style?: React.CSSProperties;
  }>;
};

export const CAMPAIGN_OBJECTIVE_OPTIONS: ObjectiveMeta[] = [
  {
    value: "OUTCOME_AWARENESS",
    label: "Awareness",
    description: "Show your ads to people who are most likely to remember them.",
    Icon: Megaphone,
  },
  {
    value: "OUTCOME_TRAFFIC",
    label: "Traffic",
    description: "Send people to a destination, like your website, app, Instagram profile, Facebook page or Facebook event.",
    Icon: MousePointer2,
  },
  {
    value: "OUTCOME_ENGAGEMENT",
    label: "Engagement",
    description: "Get more messages, purchases through messaging, video views, interactions, Page likes or event responses.",
    Icon: MessagesSquare,
  },
  {
    value: "OUTCOME_LEADS",
    label: "Leads",
    description: "Collect leads for your business or brand.",
    Icon: Filter,
  },
  {
    value: "OUTCOME_APP_PROMOTION",
    label: "App promotion",
    description: "Find new people to install your app and continue using it.",
    Icon: Users,
  },
  {
    value: "OUTCOME_SALES",
    label: "Sales",
    description: "Find people likely to purchase your product or service.",
    Icon: ShoppingBag,
  },
];

interface CampaignObjectivePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function ObjectiveRow({
  option,
  compact,
}: {
  option: ObjectiveMeta;
  compact?: boolean;
}) {
  const Icon = option.Icon;
  return (
    <span
      style={{
        display: "flex",
        alignItems: compact ? "center" : "flex-start",
        gap: 8,
        overflow: "hidden",
        minWidth: 0,
        flex: 1,
      }}
    >
      <Icon size={16} color="#9FA8A3" strokeWidth={2.2} style={{ flexShrink: 0, marginTop: compact ? 0 : 2 }} />
      <span
        style={{
          overflow: "hidden",
          textOverflow: compact ? "ellipsis" : undefined,
          whiteSpace: compact ? "nowrap" : "normal",
          minWidth: 0,
          lineHeight: 1.4,
        }}
      >
        <span style={{ fontWeight: 600 }}>{option.label}</span>
        <span style={{ fontWeight: 400, color: "#5C6A72" }}> — {option.description}</span>
      </span>
    </span>
  );
}

export default function CampaignObjectivePicker({ value, onChange }: CampaignObjectivePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({
    top: 0 as number | "auto",
    bottom: "auto" as number | "auto",
    left: 0,
    width: 0,
    maxHeight: 380,
  });

  const selectedMeta = CAMPAIGN_OBJECTIVE_OPTIONS.find((o) => o.value === value);

  const placeMenu = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const gap = 4;
    const maxLeft = window.innerWidth - rect.width - 8;
    const left = Math.min(rect.left, maxLeft);

    setDropPos({
      top: openUp ? "auto" : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : "auto",
      left: Math.max(8, left),
      width: rect.width,
      maxHeight: Math.min(380, (openUp ? spaceAbove : spaceBelow) - gap - 8),
    });
  };

  const openDropdown = () => {
    placeMenu();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => placeMenu();

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
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
        {selectedMeta ? (
          <ObjectiveRow option={selectedMeta} compact />
        ) : (
          <span style={{ color: "#8C8474" }}>Choose an objective</span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9FA8A3"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            marginLeft: 6,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: dropPos.top,
            bottom: dropPos.bottom,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: "#fff",
            borderRadius: 12,
            border: "1.5px solid #E8DCC2",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            overflow: "hidden",
            maxHeight: dropPos.maxHeight,
            overflowY: "auto",
          }}
          >
            {CAMPAIGN_OBJECTIVE_OPTIONS.map((opt) => {
              const selected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onMouseDown={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: "11px 14px",
                    fontSize: 13,
                    color: selected ? "#1A4A66" : "#003049",
                    background: selected ? "#E7F0F6" : "transparent",
                    cursor: "pointer",
                    borderBottom: "1px solid #FDF0D5",
                    transition: "background 0.1s",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) (e.currentTarget as HTMLElement).style.background = "#FDF6E3";
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <ObjectiveRow option={opt} />
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}
