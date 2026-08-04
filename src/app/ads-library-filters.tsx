"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  X,
} from "lucide-react";
import { META_AD_LIBRARY_COUNTRIES } from "@/lib/competitor-analysis/countries";

export type DatePreset = "" | "last_7" | "last_14" | "last_30" | "last_90" | "last_180";
export type DaysRunningBucket = "" | "under_7" | "7_30" | "30_90" | "over_90";

export type AdsLibraryFilterState = {
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
  daysRunning: DaysRunningBucket;
  createdFrom: string;
  createdTo: string;
  createdPreset: DatePreset;
  lastSeenFrom: string;
  lastSeenTo: string;
  lastSeenPreset: DatePreset;
  angle: string;
};

export const EMPTY_ADS_LIBRARY_FILTERS: AdsLibraryFilterState = {
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
  daysRunning: "",
  createdFrom: "",
  createdTo: "",
  createdPreset: "",
  lastSeenFrom: "",
  lastSeenTo: "",
  lastSeenPreset: "",
  angle: "",
};

export function buildAdsLibrarySearchParams(
  filters: AdsLibraryFilterState,
  debouncedQ: string,
  page: number
): URLSearchParams {
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
  if (filters.daysRunning) params.set("daysRunning", filters.daysRunning);
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
  if (debouncedQ) params.set("q", debouncedQ);
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
    !!filters.daysRunning ||
    !!filters.createdFrom ||
    !!filters.createdTo ||
    !!filters.createdPreset ||
    !!filters.lastSeenFrom ||
    !!filters.lastSeenTo ||
    !!filters.lastSeenPreset ||
    !!filters.angle
  );
}

type ActiveFilterTag = {
  id: string;
  text: string;
  clear: Partial<AdsLibraryFilterState>;
};

function formatDatePresetLabel(preset: DatePreset): string {
  return DATE_PRESETS.find((d) => d.id === preset)?.label ?? preset;
}

function buildActiveFilterTags(filters: AdsLibraryFilterState): ActiveFilterTag[] {
  const tags: ActiveFilterTag[] = [];

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

  if (filters.daysRunning) {
    const label = DAYS_RUNNING.find((d) => d.id === filters.daysRunning)?.label ?? filters.daysRunning;
    tags.push({ id: "days-running", text: `Days running: ${label}`, clear: { daysRunning: "" } });
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

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "last_7", label: "Last 7 days" },
  { id: "last_14", label: "Last 14 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
  { id: "last_180", label: "Last 180 days" },
];

const DAYS_RUNNING: Array<{ id: DaysRunningBucket; label: string }> = [
  { id: "under_7", label: "Under 7 days" },
  { id: "7_30", label: "7 – 30 days" },
  { id: "30_90", label: "30 – 90 days" },
  { id: "over_90", label: "90+ days" },
];

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
  onSearch: () => void;
  canSearch: boolean;
  showActiveFilters: boolean;
  activeFilterSource: AdsLibraryFilterState;
  facetCountries: string[];
  facetLanguages: string[];
  facetAngles: string[];
  facetAdTypes: Array<{ value: string; count: number }>;
};

export function AdsLibraryFilterBar({
  filters,
  onChange,
  onReset,
  onSearch,
  canSearch,
  showActiveFilters,
  activeFilterSource,
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

  const hasActive = showActiveFilters && adsLibraryFiltersActive(activeFilterSource);
  const activeTags = useMemo(
    () => buildActiveFilterTags(activeFilterSource),
    [activeFilterSource, showActiveFilters]
  );

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
      <form
        className="ads-library-search-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSearch) onSearch();
        }}
      >
        <input
          type="search"
          className="ads-library-search-input"
          placeholder="Search… (comma to add a term)"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
        <button
          type="submit"
          className="ads-library-search-submit"
          disabled={!canSearch}
          aria-label="Search ads"
        >
          <Search size={18} aria-hidden />
        </button>
      </form>

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

        <FilterChipShell
          chipId="days"
          openId={openId}
          setOpenId={setOpenId}
          icon={<Clock size={15} />}
          label={
            filters.daysRunning
              ? DAYS_RUNNING.find((d) => d.id === filters.daysRunning)?.label ?? "Days running"
              : "Days running"
          }
          active={!!filters.daysRunning}
        >
          {DAYS_RUNNING.map((d) => (
            <button
              key={d.id}
              type="button"
              className="ads-library-filter-menu-item"
              data-selected={filters.daysRunning === d.id ? "true" : "false"}
              onClick={() => {
                onChange({ daysRunning: filters.daysRunning === d.id ? "" : d.id });
                setOpenId(null);
              }}
            >
              {d.label}
            </button>
          ))}
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
            presets={DATE_PRESETS}
            preset={filters.createdPreset}
            from={filters.createdFrom}
            to={filters.createdTo}
            onPreset={(createdPreset) =>
              onChange({ createdPreset, createdFrom: "", createdTo: "" })
            }
            onRange={(createdFrom, createdTo) =>
              onChange({ createdFrom, createdTo, createdPreset: "" })
            }
            onClear={() => onChange({ createdPreset: "", createdFrom: "", createdTo: "" })}
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
            presets={DATE_PRESETS}
            preset={filters.lastSeenPreset}
            from={filters.lastSeenFrom}
            to={filters.lastSeenTo}
            onPreset={(lastSeenPreset) =>
              onChange({ lastSeenPreset, lastSeenFrom: "", lastSeenTo: "" })
            }
            onRange={(lastSeenFrom, lastSeenTo) =>
              onChange({ lastSeenFrom, lastSeenTo, lastSeenPreset: "" })
            }
            onClear={() => onChange({ lastSeenPreset: "", lastSeenFrom: "", lastSeenTo: "" })}
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
  presets,
  preset,
  from,
  to,
  onPreset,
  onRange,
  onClear,
}: {
  presets: Array<{ id: DatePreset; label: string }>;
  preset: DatePreset;
  from: string;
  to: string;
  onPreset: (id: DatePreset) => void;
  onRange: (from: string, to: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="ads-library-filter-date-layout">
      <div className="ads-library-filter-date-presets">
        <button type="button" className="ads-library-filter-toolbar-btn ads-library-filter-date-clear" onClick={onClear}>
          Clear
        </button>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="ads-library-filter-date-preset"
            data-selected={preset === p.id ? "true" : "false"}
            onClick={() => onPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="ads-library-filter-date-custom">
        <div className="ads-library-filter-panel-title">Custom range</div>
        <label className="ads-library-filter-date-label">
          From
          <input
            type="date"
            className="ads-library-filter-field"
            value={from}
            onChange={(e) => onRange(e.target.value, to)}
          />
        </label>
        <label className="ads-library-filter-date-label">
          To
          <input
            type="date"
            className="ads-library-filter-field"
            value={to}
            onChange={(e) => onRange(from, e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
