"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  type DatePreset,
  type DatePresetId,
  effectiveDateRange,
  formatIsoLocal,
  parseIsoDate,
  resolveDatePresetRange,
} from "@/lib/ads-library/date-presets";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PresetItem = { id: DatePresetId; label: string };

type PresetGroup = {
  title: string;
  items: PresetItem[];
};

const TOP_PRESETS: PresetItem[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_14", label: "Last 14 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_180", label: "Last 180 days" },
];

const PRESET_GROUPS: PresetGroup[] = [
  {
    title: "LAST",
    items: [
      { id: "last_90", label: "Last 90 days" },
      { id: "last_365", label: "Last 365 days" },
      { id: "last_week", label: "Last week" },
      { id: "last_month", label: "Last month" },
      { id: "last_quarter", label: "Last quarter" },
      { id: "last_12_months", label: "Last 12 months" },
      { id: "last_year", label: "Last year" },
    ],
  },
  {
    title: "PERIOD TO DATE",
    items: [
      { id: "wtd", label: "Week to date" },
      { id: "mtd", label: "Month to date" },
      { id: "qtd", label: "Quarter to date" },
      { id: "ytd", label: "Year to date" },
    ],
  },
  {
    title: "QUARTER",
    items: [
      { id: "quarter_this", label: "This quarter" },
      { id: "quarter_q1_2026", label: "Q1 2026" },
      { id: "quarter_q2_2026", label: "Q2 2026" },
      { id: "quarter_q3_2026", label: "Q3 2026" },
      { id: "quarter_q4_2025", label: "Q4 2025" },
    ],
  },
  {
    title: "SEASONAL EVENTS",
    items: [
      { id: "seasonal_mothers_day", label: "Mother's Day" },
      { id: "seasonal_valentines", label: "Valentine's Day" },
      { id: "seasonal_black_friday", label: "Black Friday week" },
      { id: "seasonal_cyber_monday", label: "Cyber Monday" },
      { id: "seasonal_christmas", label: "Christmas season" },
    ],
  },
];

function compareIso(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function isInRange(iso: string, from: string, to: string): boolean {
  if (!from || !to) return false;
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  return compareIso(iso, lo) >= 0 && compareIso(iso, hi) <= 0;
}

function buildMonthGrid(year: number, month: number): Array<{ iso: string; inMonth: boolean }> {
  const first = new Date(year, month, 1);
  const startMonday = (() => {
    const d = new Date(first);
    const dow = d.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + offset);
    return d;
  })();

  const cells: Array<{ iso: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startMonday);
    d.setDate(startMonday.getDate() + i);
    cells.push({
      iso: formatIsoLocal(d),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

type AdsLibraryDatePickerProps = {
  preset: DatePreset;
  from: string;
  to: string;
  onPreset: (id: DatePresetId) => void;
  onRange: (from: string, to: string) => void;
  /** Preset ids hidden from the sidebar (e.g. Last seen omits Today). */
  excludePresets?: DatePresetId[];
};

export function AdsLibraryDatePicker({
  preset,
  from,
  to,
  onPreset,
  onRange,
  excludePresets = [],
}: AdsLibraryDatePickerProps) {
  const range = useMemo(() => effectiveDateRange(preset, from, to), [preset, from, to]);
  const rangeFrom = range?.from ?? "";
  const rangeTo = range?.to ?? "";

  const anchorForView = parseIsoDate(rangeFrom) ?? parseIsoDate(rangeTo) ?? new Date();
  const [viewYear, setViewYear] = useState(anchorForView.getFullYear());
  const [viewMonth, setViewMonth] = useState(anchorForView.getMonth());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [pickStart, setPickStart] = useState<string | null>(null);

  const exclude = useMemo(() => new Set(excludePresets), [excludePresets]);
  const topPresets = useMemo(
    () => TOP_PRESETS.filter((p) => !exclude.has(p.id)),
    [exclude]
  );
  const presetGroups = useMemo(
    () =>
      PRESET_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((p) => !exclude.has(p.id)),
      })).filter((g) => g.items.length > 0),
    [exclude]
  );

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleDayClick = (iso: string) => {
    if (!pickStart || pickStart === iso) {
      setPickStart(iso);
      onRange(iso, iso);
      return;
    }
    const lo = pickStart <= iso ? pickStart : iso;
    const hi = pickStart <= iso ? iso : pickStart;
    setPickStart(null);
    onRange(lo, hi);
  };

  const handlePresetClick = (id: DatePresetId) => {
    setPickStart(null);
    onPreset(id);
    const { from: f, to: t } = resolveDatePresetRange(id);
    const anchor = parseIsoDate(f) ?? parseIsoDate(t);
    if (anchor) {
      setViewYear(anchor.getFullYear());
      setViewMonth(anchor.getMonth());
    }
  };

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="ads-library-date-picker">
      <div className="ads-library-date-picker-body">
        <div className="ads-library-date-picker-sidebar">
          {topPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="ads-library-filter-date-preset"
              data-selected={preset === p.id ? "true" : "false"}
              onClick={() => handlePresetClick(p.id)}
            >
              {p.label}
            </button>
          ))}

          {presetGroups.map((group) => {
            const open = !!openGroups[group.title];
            return (
              <div key={group.title} className="ads-library-date-picker-group">
                <button
                  type="button"
                  className="ads-library-date-picker-group-head"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={open}
                >
                  <span>{group.title}</span>
                  <ChevronDown size={14} className={open ? "ads-library-date-picker-chevron-open" : ""} />
                </button>
                {open &&
                  group.items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="ads-library-filter-date-preset ads-library-date-picker-group-item"
                      data-selected={preset === p.id ? "true" : "false"}
                      onClick={() => handlePresetClick(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>

        <div className="ads-library-date-picker-calendar">
          <div className="ads-library-date-picker-cal-head">
            <div className="ads-library-date-picker-cal-title">
              <span>{MONTH_NAMES[viewMonth]}</span>
              <span>{viewYear}</span>
            </div>
            <div className="ads-library-date-picker-cal-nav">
              <button type="button" className="ads-library-date-picker-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="ads-library-date-picker-nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="ads-library-date-picker-weekdays">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="ads-library-date-picker-days">
            {grid.map((cell) => {
              const inRange = isInRange(cell.iso, rangeFrom, rangeTo);
              const lo = rangeFrom && rangeTo ? (rangeFrom <= rangeTo ? rangeFrom : rangeTo) : "";
              const hi = rangeFrom && rangeTo ? (rangeFrom <= rangeTo ? rangeTo : rangeFrom) : "";
              const isStart = lo !== "" && cell.iso === lo;
              const isEnd = hi !== "" && cell.iso === hi;
              const isSingle = lo !== "" && lo === hi && cell.iso === lo;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  className="ads-library-date-picker-day"
                  data-in-month={cell.inMonth ? "true" : "false"}
                  data-in-range={inRange ? "true" : "false"}
                  data-range-start={isStart && !isSingle ? "true" : "false"}
                  data-range-end={isEnd && !isSingle ? "true" : "false"}
                  data-range-single={isSingle ? "true" : "false"}
                  onClick={() => handleDayClick(cell.iso)}
                >
                  <span>{parseIsoDate(cell.iso)?.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
