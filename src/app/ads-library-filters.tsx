"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  CircleDot,
  Clock,
  Globe,
  Image,
  Languages,
  ListTree,
  Minus,
  MonitorPlay,
  Plus,
  X,
} from "lucide-react";
import { META_AD_LIBRARY_COUNTRIES } from "@/lib/competitor-analysis/countries";
import { type DatePreset, type DatePresetId, formatDatePresetLabel } from "@/lib/ads-library/date-presets";
import { AdsLibraryDatePicker } from "./ads-library-date-picker";

export type { DatePreset };

const DAYS_RUNNING_SLIDER_MAX = 365;

export type AdsLibraryFilterState = {
  /** Committed search terms (shown as tags in the search bar). */
  searchTerms: string[];
  /** Draft text in the search input (not applied until comma / Enter). */
  q: string;
  includeCountries: string[];
  excludeCountries: string[];
  statusActive: boolean;
  statusInactive: boolean;
  includeLanguages: string[];
  excludeLanguages: string[];
  copyMin: string;
  copyMax: string;
  videoMin: string;
  videoMax: string;
  mediaTypes: string[];
  daysRunningMin: string;
  daysRunningMax: string;
  createdFrom: string;
  createdTo: string;
  createdPreset: DatePreset;
  lastSeenFrom: string;
  lastSeenTo: string;
  lastSeenPreset: DatePreset;
  angle: string;
};

export const EMPTY_ADS_LIBRARY_FILTERS: AdsLibraryFilterState = {
  searchTerms: [],
  q: "",
  includeCountries: [],
  excludeCountries: [],
  statusActive: false,
  statusInactive: false,
  includeLanguages: [],
  excludeLanguages: [],
  copyMin: "",
  copyMax: "",
  videoMin: "",
  videoMax: "",
  mediaTypes: [],
  daysRunningMin: "",
  daysRunningMax: "",
  createdFrom: "",
  createdTo: "",
  createdPreset: "",
  lastSeenFrom: "",
  lastSeenTo: "",
  lastSeenPreset: "",
  angle: "",
};

export function adsLibrarySearchQuery(filters: AdsLibraryFilterState): string {
  return filters.searchTerms.join(",");
}

export function buildAdsLibrarySearchParams(filters: AdsLibraryFilterState, page: number): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.includeCountries.length) {
    params.set("countriesInclude", filters.includeCountries.join(","));
  }
  if (filters.excludeCountries.length) {
    params.set("countriesExclude", filters.excludeCountries.join(","));
  }
  if (filters.statusActive) params.set("statusActive", "1");
  if (filters.statusInactive) params.set("statusInactive", "1");
  if (filters.includeLanguages.length) {
    params.set("languagesInclude", filters.includeLanguages.join(","));
  }
  if (filters.excludeLanguages.length) {
    params.set("languagesExclude", filters.excludeLanguages.join(","));
  }
  if (filters.copyMin) params.set("copyMin", filters.copyMin);
  if (filters.copyMax) params.set("copyMax", filters.copyMax);
  if (filters.videoMin) params.set("videoMin", filters.videoMin);
  if (filters.videoMax) params.set("videoMax", filters.videoMax);
  if (filters.mediaTypes.length) params.set("mediaTypes", filters.mediaTypes.join(","));
  if (filters.daysRunningMin) params.set("daysRunningMin", filters.daysRunningMin);
  if (filters.daysRunningMax) params.set("daysRunningMax", filters.daysRunningMax);
  if (filters.createdPreset) params.set("createdPreset", filters.createdPreset);
  else {
    if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
    if (filters.createdTo) params.set("createdTo", filters.createdTo);
  }
  if (filters.lastSeenPreset) params.set("lastSeenPreset", filters.lastSeenPreset);
  else {
    if (filters.lastSeenFrom) params.set("lastSeenFrom", filters.lastSeenFrom);
    if (filters.lastSeenTo) params.set("lastSeenTo", filters.lastSeenTo);
  }
  if (filters.angle) params.set("angle", filters.angle);
  const query = adsLibrarySearchQuery(filters);
  if (query) params.set("q", query);
  params.set("page", String(page));
  params.set("pageSize", "24");
  return params;
}

export function adsLibraryFiltersActive(filters: AdsLibraryFilterState): boolean {
  return (
    filters.includeCountries.length > 0 ||
    filters.excludeCountries.length > 0 ||
    filters.statusActive ||
    filters.statusInactive ||
    filters.includeLanguages.length > 0 ||
    filters.excludeLanguages.length > 0 ||
    !!filters.copyMin ||
    !!filters.copyMax ||
    !!filters.videoMin ||
    !!filters.videoMax ||
    filters.mediaTypes.length > 0 ||
    !!filters.daysRunningMin ||
    !!filters.daysRunningMax ||
    !!filters.createdFrom ||
    !!filters.createdTo ||
    !!filters.createdPreset ||
    !!filters.lastSeenFrom ||
    !!filters.lastSeenTo ||
    !!filters.lastSeenPreset ||
    !!filters.angle ||
    filters.searchTerms.length > 0
  );
}

type ActiveFilterTag = {
  id: string;
  text: string;
  clear: Partial<AdsLibraryFilterState>;
};

function buildActiveFilterTags(filters: AdsLibraryFilterState): ActiveFilterTag[] {
  const tags: ActiveFilterTag[] = [];

  if (filters.searchTerms.length) {
    tags.push({
      id: "search",
      text: `Search: ${filters.searchTerms.join(",")}`,
      clear: { searchTerms: [], q: "" },
    });
  }

  if (filters.statusActive || filters.statusInactive) {
    const parts = [filters.statusActive && "Active", filters.statusInactive && "Inactive"].filter(Boolean);
    tags.push({
      id: "status",
      text: `Status: ${parts.join(", ")}`,
      clear: { statusActive: false, statusInactive: false },
    });
  }

  if (filters.includeCountries.length) {
    tags.push({
      id: "countries-include",
      text: `Countries: ${filters.includeCountries.map(countryLabel).join(", ")}`,
      clear: { includeCountries: [] },
    });
  }
  if (filters.excludeCountries.length) {
    tags.push({
      id: "countries-exclude",
      text: `Countries (excl.): ${filters.excludeCountries.map(countryLabel).join(", ")}`,
      clear: { excludeCountries: [] },
    });
  }

  if (filters.includeLanguages.length) {
    tags.push({
      id: "languages-include",
      text: `Languages: ${filters.includeLanguages
        .map((c) => LANGUAGE_OPTIONS.find((l) => l.code === c)?.label ?? c)
        .join(", ")}`,
      clear: { includeLanguages: [] },
    });
  }
  if (filters.excludeLanguages.length) {
    tags.push({
      id: "languages-exclude",
      text: `Languages (excl.): ${filters.excludeLanguages
        .map((c) => LANGUAGE_OPTIONS.find((l) => l.code === c)?.label ?? c)
        .join(", ")}`,
      clear: { excludeLanguages: [] },
    });
  }

  if (filters.copyMin || filters.copyMax) {
    const min = filters.copyMin || "0";
    const max = filters.copyMax || "∞";
    tags.push({
      id: "copy-length",
      text: `Ad copy length: ${min}–${max} chars`,
      clear: { copyMin: "", copyMax: "" },
    });
  }

  if (filters.videoMin || filters.videoMax) {
    const min = filters.videoMin || "0";
    const max = filters.videoMax || "∞";
    tags.push({
      id: "video-length",
      text: `Video length: ${min}–${max}s`,
      clear: { videoMin: "", videoMax: "" },
    });
  }

  if (filters.mediaTypes.length) {
    tags.push({
      id: "media",
      text: `Media type: ${filters.mediaTypes
        .map((m) => MEDIA_TYPES.find((t) => t.id === m)?.label ?? m)
        .join(", ")}`,
      clear: { mediaTypes: [] },
    });
  }

  if (filters.daysRunningMin || filters.daysRunningMax) {
    const lo = filters.daysRunningMin || "0";
    const hi = filters.daysRunningMax || String(DAYS_RUNNING_SLIDER_MAX);
    tags.push({
      id: "days-running",
      text: `Days running: ${lo}–${hi}`,
      clear: { daysRunningMin: "", daysRunningMax: "" },
    });
  }

  if (filters.createdPreset) {
    tags.push({
      id: "created-preset",
      text: `Ad creation date: ${formatDatePresetLabel(filters.createdPreset)}`,
      clear: { createdPreset: "" },
    });
  } else if (filters.createdFrom || filters.createdTo) {
    tags.push({
      id: "created-range",
      text: `Ad creation date: ${filters.createdFrom || "…"} – ${filters.createdTo || "…"}`,
      clear: { createdFrom: "", createdTo: "" },
    });
  }

  if (filters.lastSeenPreset) {
    tags.push({
      id: "lastseen-preset",
      text: `Last seen date: ${formatDatePresetLabel(filters.lastSeenPreset)}`,
      clear: { lastSeenPreset: "" },
    });
  } else if (filters.lastSeenFrom || filters.lastSeenTo) {
    tags.push({
      id: "lastseen-range",
      text: `Last seen date: ${filters.lastSeenFrom || "…"} – ${filters.lastSeenTo || "…"}`,
      clear: { lastSeenFrom: "", lastSeenTo: "" },
    });
  }

  if (filters.angle) {
    tags.push({
      id: "angle",
      text: `Angle: ${filters.angle.replace(/\//g, " / ").replace(/-/g, " ")}`,
      clear: { angle: "" },
    });
  }

  return tags;
}

/** One count per filter chip category (include + exclude countries = 1). */
function countActiveFilterGroups(filters: AdsLibraryFilterState): number {
  let n = 0;
  if (filters.searchTerms.length) n += 1;
  if (filters.statusActive || filters.statusInactive) n += 1;
  if (filters.includeCountries.length || filters.excludeCountries.length) n += 1;
  if (filters.includeLanguages.length || filters.excludeLanguages.length) n += 1;
  if (filters.copyMin || filters.copyMax) n += 1;
  if (filters.videoMin || filters.videoMax) n += 1;
  if (filters.mediaTypes.length) n += 1;
  if (filters.daysRunningMin || filters.daysRunningMax) n += 1;
  if (filters.createdPreset || filters.createdFrom || filters.createdTo) n += 1;
  if (filters.lastSeenPreset || filters.lastSeenFrom || filters.lastSeenTo) n += 1;
  if (filters.angle) n += 1;
  return n;
}

function flagEmoji(code: string) {
  const c = code.toUpperCase();
  if (c.length !== 2) return "🏳️";
  const pts = [...c].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0));
  return String.fromCodePoint(...pts);
}

function countryLabel(code: string) {
  const name = META_AD_LIBRARY_COUNTRIES.find((x) => x.shortcut === code)?.name ?? code;
  return name;
}

function languageFlag(code: string) {
  const map: Record<string, string> = {
    en: "US",
    nl: "NL",
    de: "DE",
    fr: "FR",
    es: "ES",
    it: "IT",
    pt: "PT",
    pl: "PL",
    sv: "SE",
    da: "DK",
    fi: "FI",
    no: "NO",
  };
  return flagEmoji(map[code] ?? code.toUpperCase().slice(0, 2));
}

const LANGUAGE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "nl", label: "Dutch" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "no", label: "Norwegian" },
];

const COUNTRY_GROUPS: Array<{ title: string; codes: string[] }> = [
  { title: "Top 5", codes: ["US", "GB", "CA", "AU", "DE"] },
  {
    title: "Europe",
    codes: ["GB", "DE", "FR", "IT", "ES", "NL", "PL", "SE", "DK", "FI", "PT", "GR", "TR", "AT"],
  },
  { title: "South America", codes: ["BR", "MX", "AR", "CO", "CL"] },
];

const DAYS_RUNNING_PRESETS: { min: number; max: number; label: string }[] = [
  { min: 0, max: 7, label: "Just started (0–7)" },
  { min: 7, max: 30, label: "Validated (7–30)" },
  { min: 30, max: DAYS_RUNNING_SLIDER_MAX, label: "Evergreen (30+)" },
];

function clampDays(n: number): number {
  return Math.min(DAYS_RUNNING_SLIDER_MAX, Math.max(0, Math.round(n)));
}

function parseDaysField(value: string, fallback: number): number {
  if (value.trim() === "") return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return clampDays(n);
}

function daysRunningBounds(min: string, max: string): { lo: number; hi: number; active: boolean } {
  const active = min.trim() !== "" || max.trim() !== "";
  const lo = parseDaysField(min, 0);
  const hi = parseDaysField(max, DAYS_RUNNING_SLIDER_MAX);
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), active };
}

function thumbPositionStyle(value: number): React.CSSProperties {
  const pct = (value / DAYS_RUNNING_SLIDER_MAX) * 100;
  if (value <= 0) return { left: "0%", transform: "translate(0, -50%)" };
  if (value >= DAYS_RUNNING_SLIDER_MAX) return { left: "100%", transform: "translate(-100%, -50%)" };
  return { left: `${pct}%`, transform: "translate(-50%, -50%)" };
}

function DaysRunningDualSlider({
  lo,
  hi,
  onRangeChange,
}: {
  lo: number;
  hi: number;
  onRangeChange: (newLo: number, newHi: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"min" | "max" | null>(null);
  /** Which thumb paints above the other when they overlap (last pointer down wins). */
  const [topThumb, setTopThumb] = useState<"min" | "max">("max");
  const [draggingThumb, setDraggingThumb] = useState<"min" | "max" | null>(null);

  const valueFromPointer = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return clampDays(Math.round(ratio * DAYS_RUNNING_SLIDER_MAX));
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const v = valueFromPointer(e.clientX);
      if (dragging.current === "min") {
        onRangeChange(Math.min(v, hi), hi);
      } else {
        onRangeChange(lo, Math.max(v, lo));
      }
    };
    const onUp = () => {
      dragging.current = null;
      setDraggingThumb(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [hi, lo, onRangeChange, valueFromPointer]);

  const loPct = (lo / DAYS_RUNNING_SLIDER_MAX) * 100;
  const hiPct = (hi / DAYS_RUNNING_SLIDER_MAX) * 100;

  const onThumbDown = (which: "min" | "max") => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dragging.current = which;
    setTopThumb(which);
    setDraggingThumb(which);
  };

  const thumbClass = (which: "min" | "max") => {
    const parts = ["ads-library-days-slider-thumb"];
    if (topThumb === which) parts.push("is-on-top");
    if (draggingThumb === which) parts.push("is-dragging");
    return parts.join(" ");
  };

  const minThumb = (
    <button
      type="button"
      role="slider"
      tabIndex={0}
      className={thumbClass("min")}
      style={thumbPositionStyle(lo)}
      aria-label={`Minimum days running: ${lo}`}
      onPointerDown={onThumbDown("min")}
    />
  );

  const maxThumb = (
    <button
      type="button"
      role="slider"
      tabIndex={0}
      className={thumbClass("max")}
      style={thumbPositionStyle(hi)}
      aria-label={`Maximum days running: ${hi}`}
      onPointerDown={onThumbDown("max")}
    />
  );

  return (
    <div className="ads-library-days-slider-track" ref={trackRef}>
      <div className="ads-library-days-slider-rail" aria-hidden />
      <div
        className="ads-library-days-slider-fill"
        style={{ left: `${loPct}%`, width: `${Math.max(0, hiPct - loPct)}%` }}
      />
      {topThumb === "min" ? (
        <>
          {maxThumb}
          {minThumb}
        </>
      ) : (
        <>
          {minThumb}
          {maxThumb}
        </>
      )}
    </div>
  );
}

function DaysRunningFilterPanel({
  min,
  max,
  onChange,
}: {
  min: string;
  max: string;
  onChange: (patch: { daysRunningMin: string; daysRunningMax: string }) => void;
}) {
  const { lo, hi, active } = daysRunningBounds(min, max);

  const applyRange = (newLo: number, newHi: number) => {
    const a = clampDays(Math.min(newLo, newHi));
    const b = clampDays(Math.max(newLo, newHi));
    onChange({ daysRunningMin: String(a), daysRunningMax: String(b) });
  };

  const onMinInput = (raw: string) => {
    if (raw.trim() === "") {
      onChange({ daysRunningMin: "", daysRunningMax: max });
      return;
    }
    const n = clampDays(parseInt(raw, 10));
    if (!Number.isFinite(n)) return;
    applyRange(n, active ? hi : DAYS_RUNNING_SLIDER_MAX);
  };

  const onMaxInput = (raw: string) => {
    if (raw.trim() === "") {
      onChange({ daysRunningMin: min, daysRunningMax: "" });
      return;
    }
    const n = clampDays(parseInt(raw, 10));
    if (!Number.isFinite(n)) return;
    applyRange(active ? lo : 0, n);
  };

  const loPct = (lo / DAYS_RUNNING_SLIDER_MAX) * 100;
  const hiPct = (hi / DAYS_RUNNING_SLIDER_MAX) * 100;
  const bubblesOverlap = hi - lo < 24;

  const bubbleStyle = (value: number, stackHigh: boolean): React.CSSProperties => {
    const pct = (value / DAYS_RUNNING_SLIDER_MAX) * 100;
    const base: React.CSSProperties = stackHigh ? { top: 14 } : { top: 0 };
    if (value <= 0) return { ...base, left: "0%", transform: "translateX(0)" };
    if (value >= DAYS_RUNNING_SLIDER_MAX) return { ...base, left: "100%", transform: "translateX(-100%)" };
    return { ...base, left: `${pct}%`, transform: "translateX(-50%)" };
  };

  return (
    <div className="ads-library-days-running-panel">
      <div className="ads-library-filter-panel-title">Days Running</div>

      <div className="ads-library-days-slider-wrap">
        <div className="ads-library-days-slider-bubbles" aria-hidden>
          <span className="ads-library-days-slider-bubble" style={bubbleStyle(lo, false)}>
            {lo}
          </span>
          <span
            className="ads-library-days-slider-bubble ads-library-days-slider-bubble--max"
            style={bubbleStyle(hi, bubblesOverlap)}
          >
            {hi}
          </span>
        </div>
        <DaysRunningDualSlider lo={lo} hi={hi} onRangeChange={applyRange} />
      </div>

      <div className="ads-library-days-inputs">
        <input
          type="number"
          className="ads-library-filter-field"
          placeholder="Min"
          min={0}
          max={DAYS_RUNNING_SLIDER_MAX}
          value={
            active
              ? min !== ""
                ? min
                : String(lo)
              : ""
          }
          onChange={(e) => onMinInput(e.target.value)}
        />
        <input
          type="number"
          className="ads-library-filter-field"
          placeholder="Max"
          min={0}
          max={DAYS_RUNNING_SLIDER_MAX}
          value={
            active
              ? max !== ""
                ? max
                : String(hi)
              : ""
          }
          onChange={(e) => onMaxInput(e.target.value)}
        />
      </div>

      <div className="ads-library-filter-range-pills ads-library-days-presets">
        {DAYS_RUNNING_PRESETS.map((p) => {
          const selected = active && lo === p.min && hi === p.max;
          return (
            <button
              key={p.label}
              type="button"
              className="ads-library-filter-pill"
              data-selected={selected ? "true" : "false"}
              onClick={() => applyRange(p.min, p.max)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {active && (
        <button
          type="button"
          className="ads-library-filter-toolbar-btn ads-library-days-clear"
          onClick={() => onChange({ daysRunningMin: "", daysRunningMax: "" })}
        >
          Clear range
        </button>
      )}
    </div>
  );
}

const MEDIA_TYPES = [
  { id: "video", label: "Videos" },
  { id: "image", label: "Images" },
  { id: "carousel", label: "Carousel" },
  { id: "text", label: "Text" },
];

type FilterChipShellProps = {
  chipId: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  panelClass?: string;
  children: React.ReactNode;
};

function FilterChipShell({
  chipId,
  openId,
  setOpenId,
  icon,
  label,
  active,
  panelClass,
  children,
}: FilterChipShellProps) {
  const open = openId === chipId;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, setOpenId]);

  return (
    <div ref={rootRef} className="ads-library-filter-chip-wrap">
      <button
        type="button"
        onClick={() => setOpenId(open ? null : chipId)}
        className="ads-library-filter-chip"
        data-active={active ? "true" : "false"}
        data-open={open ? "true" : "false"}
        aria-expanded={open}
      >
        <span className="ads-library-filter-chip-icon">{icon}</span>
        <span className="ads-library-filter-chip-label">{label}</span>
        <ChevronDown size={14} className="ads-library-filter-chip-chevron" />
      </button>
      {open && (
        <div className={`ads-library-filter-panel ${panelClass ?? ""}`.trim()} role="dialog">
          {children}
        </div>
      )}
    </div>
  );
}

function PanelToolbar({
  onIncludeAll,
  onExcludeAll,
  onClear,
}: {
  onIncludeAll?: () => void;
  onExcludeAll?: () => void;
  onClear: () => void;
}) {
  return (
    <div className="ads-library-filter-panel-toolbar">
      {onIncludeAll && (
        <button type="button" className="ads-library-filter-toolbar-btn" onClick={onIncludeAll}>
          + Include All
        </button>
      )}
      {onExcludeAll && (
        <button type="button" className="ads-library-filter-toolbar-btn" onClick={onExcludeAll}>
          − Exclude All
        </button>
      )}
      <button type="button" className="ads-library-filter-toolbar-btn" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

function IncludeExcludeRow({
  label,
  flag,
  included,
  excluded,
  onInclude,
  onExclude,
}: {
  label: string;
  flag?: string;
  included: boolean;
  excluded: boolean;
  onInclude: () => void;
  onExclude: () => void;
}) {
  return (
    <div className="ads-library-filter-panel-row" data-included={included ? "true" : "false"}>
      <span className="ads-library-filter-row-flag">{flag}</span>
      <span className="ads-library-filter-row-label">{label}</span>
      <span className="ads-library-filter-row-actions">
        <button
          type="button"
          className="ads-library-filter-icon-btn"
          data-selected={included ? "true" : "false"}
          aria-label={`Include ${label}`}
          onClick={onInclude}
        >
          <Plus size={12} />
        </button>
        <button
          type="button"
          className="ads-library-filter-icon-btn"
          data-selected={excluded ? "true" : "false"}
          aria-label={`Exclude ${label}`}
          onClick={onExclude}
        >
          <Minus size={12} />
        </button>
      </span>
    </div>
  );
}

type AdsLibraryFilterBarProps = {
  filters: AdsLibraryFilterState;
  onChange: (patch: Partial<AdsLibraryFilterState>) => void;
  onReset: () => void;
  facetCountries: string[];
  facetLanguages: string[];
  facetAngles: string[];
  facetAdTypes: Array<{ value: string; count: number }>;
};

function pushSearchTerms(existing: string[], raw: string): string[] {
  const next = [...existing];
  for (const part of raw.split(",")) {
    const term = part.trim();
    if (term && !next.some((t) => t.toLowerCase() === term.toLowerCase())) {
      next.push(term);
    }
  }
  return next;
}

function SearchTermsField({
  filters,
  onChange,
}: {
  filters: AdsLibraryFilterState;
  onChange: (patch: Partial<AdsLibraryFilterState>) => void;
}) {
  const commitDraft = () => {
    const draft = filters.q.trim();
    if (!draft) return;
    onChange({
      searchTerms: pushSearchTerms(filters.searchTerms, draft),
      q: "",
    });
  };

  const removeTerm = (term: string) => {
    onChange({ searchTerms: filters.searchTerms.filter((t) => t !== term) });
  };

  const clearAll = () => {
    onChange({ searchTerms: [], q: "" });
  };

  const showClear = filters.searchTerms.length > 0 || filters.q.trim().length > 0;

  return (
    <div className="ads-library-search-row">
      <div className="ads-library-search-combobox">
        {filters.searchTerms.map((term) => (
          <span key={term} className="ads-library-search-term">
            <span>{term}</span>
            <button
              type="button"
              className="ads-library-search-term-remove"
              aria-label={`Remove ${term}`}
              onClick={() => removeTerm(term)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="ads-library-search-input-inline"
          placeholder={
            filters.searchTerms.length ? "Search… (comma to add a term)" : "Search… (comma to add a term)"
          }
          value={filters.q}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) {
              const parts = v.split(",");
              const last = parts.pop() ?? "";
              onChange({
                searchTerms: pushSearchTerms(filters.searchTerms, parts.join(",")),
                q: last,
              });
            } else {
              onChange({ q: v });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            }
            if (e.key === "Backspace" && !filters.q && filters.searchTerms.length > 0) {
              onChange({ searchTerms: filters.searchTerms.slice(0, -1) });
            }
          }}
          onBlur={commitDraft}
        />
      </div>
      {showClear && (
        <button
          type="button"
          className="ads-library-search-clear"
          aria-label="Clear search terms"
          onClick={clearAll}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function AdsLibraryFilterBar({
  filters,
  onChange,
  onReset,
  facetCountries,
  facetLanguages,
  facetAngles,
}: AdsLibraryFilterBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const countryCodes = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const g of COUNTRY_GROUPS) {
      for (const code of g.codes) {
        if (!seen.has(code)) {
          seen.add(code);
          ordered.push(code);
        }
      }
    }
    for (const code of facetCountries) {
      if (!seen.has(code)) {
        seen.add(code);
        ordered.push(code);
      }
    }
    return { ordered, seen };
  }, [facetCountries]);

  const languageList = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ code: string; label: string }> = [];
    for (const code of facetLanguages) {
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const from = LANGUAGE_OPTIONS.find((l) => l.code === code);
      list.push({ code, label: from?.label ?? code.toUpperCase() });
    }
    for (const opt of LANGUAGE_OPTIONS) {
      if (!seen.has(opt.code)) list.push(opt);
    }
    return list;
  }, [facetLanguages]);

  const toggleCountry = (code: string, mode: "include" | "exclude") => {
    const inc = new Set(filters.includeCountries);
    const exc = new Set(filters.excludeCountries);
    if (mode === "include") {
      exc.delete(code);
      if (inc.has(code)) inc.delete(code);
      else inc.add(code);
    } else {
      inc.delete(code);
      if (exc.has(code)) exc.delete(code);
      else exc.add(code);
    }
    onChange({
      includeCountries: [...inc],
      excludeCountries: [...exc],
    });
  };

  const toggleLanguage = (code: string, mode: "include" | "exclude") => {
    const inc = new Set(filters.includeLanguages);
    const exc = new Set(filters.excludeLanguages);
    if (mode === "include") {
      exc.delete(code);
      if (inc.has(code)) inc.delete(code);
      else inc.add(code);
    } else {
      inc.delete(code);
      if (exc.has(code)) exc.delete(code);
      else exc.add(code);
    }
    onChange({
      includeLanguages: [...inc],
      excludeLanguages: [...exc],
    });
  };

  const hasActive = adsLibraryFiltersActive(filters);
  const activeTags = useMemo(() => buildActiveFilterTags(filters), [filters]);
  const activeFilterGroupCount = useMemo(() => countActiveFilterGroups(filters), [filters]);

  const statusSummary =
    filters.statusActive || filters.statusInactive
      ? [filters.statusActive && "Active", filters.statusInactive && "Inactive"].filter(Boolean).join(", ")
      : "Status";

  const countrySummary =
    filters.includeCountries.length || filters.excludeCountries.length
      ? `Countries (${filters.includeCountries.length + filters.excludeCountries.length})`
      : "Countries";

  return (
    <div className="ads-library-filters">
      <SearchTermsField filters={filters} onChange={onChange} />

      <div className="ads-library-filter-grid-row">
        <div className="ads-library-filter-grid">
        <FilterChipShell
          chipId="status"
          openId={openId}
          setOpenId={setOpenId}
          icon={<CircleDot size={15} />}
          label={statusSummary}
          active={filters.statusActive || filters.statusInactive}
        >
          <label className="ads-library-filter-checkrow">
            <input
              type="checkbox"
              checked={filters.statusActive}
              onChange={(e) => onChange({ statusActive: e.target.checked })}
            />
            <span>Active</span>
          </label>
          <label className="ads-library-filter-checkrow">
            <input
              type="checkbox"
              checked={filters.statusInactive}
              onChange={(e) => onChange({ statusInactive: e.target.checked })}
            />
            <span>Inactive</span>
          </label>
        </FilterChipShell>

        <FilterChipShell
          chipId="countries"
          openId={openId}
          setOpenId={setOpenId}
          icon={<Globe size={15} />}
          label={countrySummary}
          active={filters.includeCountries.length > 0 || filters.excludeCountries.length > 0}
          panelClass="ads-library-filter-panel--wide"
        >
          <PanelToolbar
            onIncludeAll={() =>
              onChange({
                includeCountries: countryCodes.ordered,
                excludeCountries: [],
              })
            }
            onExcludeAll={() =>
              onChange({
                excludeCountries: countryCodes.ordered,
                includeCountries: [],
              })
            }
            onClear={() => onChange({ includeCountries: [], excludeCountries: [] })}
          />
          <div className="ads-library-filter-panel-scroll">
            {COUNTRY_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="ads-library-filter-panel-group-title">{group.title}</div>
                {group.codes.map((code) => (
                  <IncludeExcludeRow
                    key={code}
                    flag={flagEmoji(code)}
                    label={countryLabel(code)}
                    included={filters.includeCountries.includes(code)}
                    excluded={filters.excludeCountries.includes(code)}
                    onInclude={() => toggleCountry(code, "include")}
                    onExclude={() => toggleCountry(code, "exclude")}
                  />
                ))}
              </div>
            ))}
          </div>
        </FilterChipShell>

        <FilterChipShell
          chipId="language"
          openId={openId}
          setOpenId={setOpenId}
          icon={<Languages size={15} />}
          label={
            filters.includeLanguages.length || filters.excludeLanguages.length
              ? `Language (${filters.includeLanguages.length + filters.excludeLanguages.length})`
              : "Language"
          }
          active={filters.includeLanguages.length > 0 || filters.excludeLanguages.length > 0}
          panelClass="ads-library-filter-panel--wide"
        >
          <PanelToolbar
            onIncludeAll={() =>
              onChange({
                includeLanguages: languageList.map((l) => l.code),
                excludeLanguages: [],
              })
            }
            onExcludeAll={() =>
              onChange({
                excludeLanguages: languageList.map((l) => l.code),
                includeLanguages: [],
              })
            }
            onClear={() => onChange({ includeLanguages: [], excludeLanguages: [] })}
          />
          <div className="ads-library-filter-panel-scroll">
            {languageList.map((lang) => (
              <IncludeExcludeRow
                key={lang.code}
                flag={languageFlag(lang.code)}
                label={lang.label}
                included={filters.includeLanguages.includes(lang.code)}
                excluded={filters.excludeLanguages.includes(lang.code)}
                onInclude={() => toggleLanguage(lang.code, "include")}
                onExclude={() => toggleLanguage(lang.code, "exclude")}
              />
            ))}
          </div>
        </FilterChipShell>

        <FilterChipShell
          chipId="copy"
          openId={openId}
          setOpenId={setOpenId}
          icon={<AlignLeft size={15} />}
          label={filters.copyMin || filters.copyMax ? "Ad copy length •" : "Ad copy length"}
          active={!!filters.copyMin || !!filters.copyMax}
        >
          <div className="ads-library-filter-panel-title">Ad copy length (characters)</div>
          <div className="ads-library-filter-range-inputs">
            <input
              type="number"
              className="ads-library-filter-field"
              placeholder="Min"
              min={0}
              value={filters.copyMin}
              onChange={(e) => onChange({ copyMin: e.target.value, copyMax: filters.copyMax })}
            />
            <input
              type="number"
              className="ads-library-filter-field"
              placeholder="Max"
              min={0}
              value={filters.copyMax}
              onChange={(e) => onChange({ copyMax: e.target.value, copyMin: filters.copyMin })}
            />
          </div>
          <div className="ads-library-filter-range-pills">
            {[
              { label: "<100 chars", min: "", max: "99" },
              { label: "100–300", min: "100", max: "300" },
              { label: "300–700", min: "300", max: "700" },
              { label: "700+", min: "700", max: "" },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                className="ads-library-filter-pill"
                onClick={() => onChange({ copyMin: p.min, copyMax: p.max })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </FilterChipShell>

        <FilterChipShell
          chipId="video"
          openId={openId}
          setOpenId={setOpenId}
          icon={<MonitorPlay size={15} />}
          label={filters.videoMin || filters.videoMax ? "Video length •" : "Video length"}
          active={!!filters.videoMin || !!filters.videoMax}
        >
          <div className="ads-library-filter-panel-title">Video length (seconds)</div>
          <div className="ads-library-filter-range-inputs">
            <input
              type="number"
              className="ads-library-filter-field"
              placeholder="Min"
              min={0}
              value={filters.videoMin}
              onChange={(e) => onChange({ videoMin: e.target.value })}
            />
            <input
              type="number"
              className="ads-library-filter-field"
              placeholder="Max"
              min={0}
              value={filters.videoMax}
              onChange={(e) => onChange({ videoMax: e.target.value })}
            />
          </div>
          <div className="ads-library-filter-range-pills">
            {[
              { label: "<1 min", min: "", max: "59" },
              { label: "1–3 min", min: "60", max: "180" },
              { label: "3–5 min", min: "181", max: "300" },
              { label: "5+ min", min: "301", max: "" },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                className="ads-library-filter-pill"
                onClick={() => onChange({ videoMin: p.min, videoMax: p.max })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </FilterChipShell>

        <FilterChipShell
          chipId="media"
          openId={openId}
          setOpenId={setOpenId}
          icon={<Image size={15} />}
          label={filters.mediaTypes.length ? `Media type (${filters.mediaTypes.length})` : "Media type"}
          active={filters.mediaTypes.length > 0}
        >
          {MEDIA_TYPES.map((m) => (
            <label key={m.id} className="ads-library-filter-checkrow">
              <input
                type="checkbox"
                checked={filters.mediaTypes.includes(m.id)}
                onChange={(e) => {
                  const set = new Set(filters.mediaTypes);
                  if (e.target.checked) set.add(m.id);
                  else set.delete(m.id);
                  onChange({ mediaTypes: [...set] });
                }}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </FilterChipShell>
        </div>
        {activeFilterGroupCount > 0 && (
          <span className="ads-library-filter-active-count" aria-live="polite">
            {activeFilterGroupCount === 1
              ? "1 filter active"
              : `${activeFilterGroupCount} filters active`}
          </span>
        )}
      </div>

      <div className="ads-library-filter-grid-row ads-library-filter-grid-row--secondary">
        <div className="ads-library-filter-grid">
        <FilterChipShell
          chipId="days"
          openId={openId}
          setOpenId={setOpenId}
          icon={<Clock size={15} />}
          label={
            filters.daysRunningMin || filters.daysRunningMax
              ? `Days running (${filters.daysRunningMin || "0"}–${filters.daysRunningMax || DAYS_RUNNING_SLIDER_MAX})`
              : "Days running"
          }
          active={!!(filters.daysRunningMin || filters.daysRunningMax)}
          panelClass="ads-library-filter-panel--days-running"
        >
          <DaysRunningFilterPanel
            min={filters.daysRunningMin}
            max={filters.daysRunningMax}
            onChange={onChange}
          />
        </FilterChipShell>

        <FilterChipShell
          chipId="created"
          openId={openId}
          setOpenId={setOpenId}
          icon={<Calendar size={15} />}
          label={
            filters.createdPreset || filters.createdFrom || filters.createdTo
              ? "Ad creation date •"
              : "Ad creation date"
          }
          active={!!filters.createdPreset || !!filters.createdFrom || !!filters.createdTo}
          panelClass="ads-library-filter-panel--date"
        >
          <DateFilterPanel
            preset={filters.createdPreset}
            from={filters.createdFrom}
            to={filters.createdTo}
            onPreset={(createdPreset) =>
              onChange({ createdPreset, createdFrom: "", createdTo: "" })
            }
            onRange={(createdFrom, createdTo) =>
              onChange({ createdFrom, createdTo, createdPreset: "" })
            }
          />
        </FilterChipShell>

        <FilterChipShell
          chipId="lastseen"
          openId={openId}
          setOpenId={setOpenId}
          icon={<Calendar size={15} />}
          label={
            filters.lastSeenPreset || filters.lastSeenFrom || filters.lastSeenTo
              ? "Last seen date •"
              : "Last seen date"
          }
          active={!!filters.lastSeenPreset || !!filters.lastSeenFrom || !!filters.lastSeenTo}
          panelClass="ads-library-filter-panel--date"
        >
          <DateFilterPanel
            preset={filters.lastSeenPreset}
            from={filters.lastSeenFrom}
            to={filters.lastSeenTo}
            excludePresets={["today"]}
            onPreset={(lastSeenPreset) =>
              onChange({ lastSeenPreset, lastSeenFrom: "", lastSeenTo: "" })
            }
            onRange={(lastSeenFrom, lastSeenTo) =>
              onChange({ lastSeenFrom, lastSeenTo, lastSeenPreset: "" })
            }
          />
        </FilterChipShell>

        <FilterChipShell
          chipId="angle"
          openId={openId}
          setOpenId={setOpenId}
          icon={<ListTree size={15} />}
          label={
            filters.angle
              ? filters.angle.replace(/\//g, " / ").replace(/-/g, " ")
              : "Angle"
          }
          active={!!filters.angle}
        >
          <button
            type="button"
            className="ads-library-filter-menu-item"
            data-selected={filters.angle === "" ? "true" : "false"}
            onClick={() => {
              onChange({ angle: "" });
              setOpenId(null);
            }}
          >
            All angles
          </button>
          {facetAngles.map((a) => (
            <button
              key={a}
              type="button"
              className="ads-library-filter-menu-item"
              data-selected={filters.angle === a ? "true" : "false"}
              onClick={() => {
                onChange({ angle: a });
                setOpenId(null);
              }}
            >
              {a.replace(/\//g, " / ").replace(/-/g, " ")}
            </button>
          ))}
        </FilterChipShell>
        </div>
      </div>

      {hasActive && (
        <div className="ads-library-active-filters">
          <span className="ads-library-active-filters-label">Active filters:</span>
          <div className="ads-library-active-filters-tags">
            {activeTags.map((tag) => (
              <span key={tag.id} className="ads-library-active-filter-tag">
                <span className="ads-library-active-filter-tag-text">{tag.text}</span>
                <button
                  type="button"
                  className="ads-library-active-filter-tag-remove"
                  aria-label={`Remove ${tag.text}`}
                  onClick={() => onChange(tag.clear)}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <button type="button" className="ads-library-active-filters-clear-all" onClick={onReset}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function DateFilterPanel({
  preset,
  from,
  to,
  onPreset,
  onRange,
  excludePresets,
}: {
  preset: DatePreset;
  from: string;
  to: string;
  onPreset: (id: DatePresetId) => void;
  onRange: (from: string, to: string) => void;
  excludePresets?: DatePresetId[];
}) {
  return (
    <AdsLibraryDatePicker
      key={preset || "custom-range"}
      preset={preset}
      from={from}
      to={to}
      onPreset={onPreset}
      onRange={onRange}
      excludePresets={excludePresets}
    />
  );
}
