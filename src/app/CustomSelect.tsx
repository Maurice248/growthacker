"use client";
import React, { useState, useRef, useEffect } from "react";

interface Option { value: string; label: string }

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  style?: React.CSSProperties;
  variant?: "default" | "editorial";
}

export default function CustomSelect({ value, onChange, options, style, variant = "default" }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0, openUp: false });

  const selectedLabel = options.find(o => o.value === value)?.label || value;
  const isEditorial = variant === "editorial";

  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const dropHeight = Math.min(options.length * 44, 220);

    // Clamp left so dropdown never overflows right edge
    const maxLeft = window.innerWidth - rect.width - 8;
    const left = Math.min(rect.left, maxLeft);

    setDropPos({
      top: openUp ? rect.top - dropHeight - 4 : rect.bottom + 4,
      left: Math.max(8, left),
      width: rect.width,
      openUp,
    });
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        style={{
          width: "100%",
          padding: isEditorial ? "10px 24px 10px 0" : "10px 32px 10px 12px",
          borderRadius: isEditorial ? 0 : 10,
          border: isEditorial ? "none" : open ? "1.5px solid #669BBC" : "1.5px solid #E8DCC2",
          borderBottom: isEditorial ? "1px solid #C2B79A" : undefined,
          background: isEditorial ? "transparent" : open ? "#fff" : "#FDF6E3",
          color: "#003049",
          fontSize: isEditorial ? 15 : 13,
          fontWeight: 500,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: isEditorial ? "none" : open ? "0 0 0 3px rgba(0,48,73,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxSizing: "border-box",
          position: "relative",
          ...style,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selectedLabel}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#9FA8A3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, marginLeft: 6, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          {/* Invisible backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onMouseDown={() => setOpen(false)}
          />
          {/* Dropdown list — fixed, clamped to viewport */}
          <div
            style={{
              position: "fixed",
              top: dropPos.top,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 9999,
              background: "#fff",
              borderRadius: 12,
              border: "1.5px solid #E8DCC2",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
              overflow: "hidden",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {options.map(opt => (
              <div
                key={opt.value}
                onMouseDown={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  padding: "11px 14px",
                  fontSize: 13,
                  fontWeight: opt.value === value ? 700 : 500,
                  color: opt.value === value ? "#1A4A66" : "#003049",
                  background: opt.value === value ? "#E7F0F6" : "transparent",
                  cursor: "pointer",
                  borderBottom: "1px solid #FDF0D5",
                  transition: "background 0.1s",
                  userSelect: "none",
                }}
                onMouseEnter={e => { if (opt.value !== value) (e.target as HTMLElement).style.background = "#FDF6E3"; }}
                onMouseLeave={e => { if (opt.value !== value) (e.target as HTMLElement).style.background = "transparent"; }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
