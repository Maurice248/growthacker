export const DATE_PRESET_IDS = [
  "today",
  "yesterday",
  "last_7",
  "last_14",
  "last_30",
  "last_180",
  "last_90",
  "last_365",
  "last_week",
  "last_month",
  "last_quarter",
  "last_12_months",
  "last_year",
  "wtd",
  "mtd",
  "qtd",
  "ytd",
  "quarter_this",
  "quarter_q1_2026",
  "quarter_q2_2026",
  "quarter_q3_2026",
  "quarter_q4_2025",
  "seasonal_mothers_day",
  "seasonal_valentines",
  "seasonal_black_friday",
  "seasonal_cyber_monday",
  "seasonal_christmas",
] as const;

export type DatePresetId = (typeof DATE_PRESET_IDS)[number];

export type DatePreset = "" | DatePresetId;

export type DateRange = { from: string; to: string };

export const DATE_PRESET_LABELS: Record<DatePresetId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7: "Last 7 days",
  last_14: "Last 14 days",
  last_30: "Last 30 days",
  last_180: "Last 180 days",
  last_90: "Last 90 days",
  last_365: "Last 365 days",
  last_week: "Last week",
  last_month: "Last month",
  last_quarter: "Last quarter",
  last_12_months: "Last 12 months",
  last_year: "Last year",
  wtd: "Week to date",
  mtd: "Month to date",
  qtd: "Quarter to date",
  ytd: "Year to date",
  quarter_this: "This quarter",
  quarter_q1_2026: "Q1 2026",
  quarter_q2_2026: "Q2 2026",
  quarter_q3_2026: "Q3 2026",
  quarter_q4_2025: "Q4 2025",
  seasonal_mothers_day: "Mother's Day",
  seasonal_valentines: "Valentine's Day",
  seasonal_black_friday: "Black Friday week",
  seasonal_cyber_monday: "Cyber Monday",
  seasonal_christmas: "Christmas season",
};

export function isDatePresetId(value: string): value is DatePresetId {
  return (DATE_PRESET_IDS as readonly string[]).includes(value);
}

export function formatDatePresetLabel(preset: DatePreset): string {
  if (!preset) return "";
  return DATE_PRESET_LABELS[preset] ?? preset;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function mondayOfWeek(d: Date): Date {
  const x = startOfLocalDay(d);
  const dow = x.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(x, offset);
}

function sundayOfWeek(d: Date): Date {
  return addDays(mondayOfWeek(d), 6);
}

function quarterStart(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const month = (quarter - 1) * 3;
  return new Date(year, month, 1);
}

function quarterEnd(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const month = quarter * 3;
  return new Date(year, month, 0);
}

function currentQuarter(ref: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(ref.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

/** US Thanksgiving — fourth Thursday in November. */
function thanksgivingUtcYear(year: number): Date {
  const nov1 = new Date(year, 10, 1);
  const dow = nov1.getDay();
  const firstThuOffset = (4 - dow + 7) % 7;
  return addDays(nov1, firstThuOffset + 21);
}

function mothersDayYear(year: number): Date {
  const may1 = new Date(year, 4, 1);
  const dow = may1.getDay();
  const firstSunOffset = (7 - dow) % 7;
  return addDays(may1, firstSunOffset + 7);
}

function seasonalRangeForYear(
  preset: Extract<
    DatePresetId,
    | "seasonal_mothers_day"
    | "seasonal_valentines"
    | "seasonal_black_friday"
    | "seasonal_cyber_monday"
    | "seasonal_christmas"
  >,
  year: number
): DateRange {
  switch (preset) {
    case "seasonal_valentines":
      return { from: formatIsoLocal(new Date(year, 1, 1)), to: formatIsoLocal(new Date(year, 1, 14)) };
    case "seasonal_mothers_day": {
      const md = mothersDayYear(year);
      const from = addDays(md, -6);
      return { from: formatIsoLocal(from), to: formatIsoLocal(md) };
    }
    case "seasonal_black_friday": {
      const tg = thanksgivingUtcYear(year);
      const bf = addDays(tg, 1);
      const from = addDays(bf, -3);
      const to = addDays(bf, 3);
      return { from: formatIsoLocal(from), to: formatIsoLocal(to) };
    }
    case "seasonal_cyber_monday": {
      const tg = thanksgivingUtcYear(year);
      const cm = addDays(tg, 4);
      return { from: formatIsoLocal(cm), to: formatIsoLocal(cm) };
    }
    case "seasonal_christmas":
      return { from: formatIsoLocal(new Date(year, 11, 1)), to: formatIsoLocal(new Date(year, 11, 25)) };
    default:
      return { from: "", to: "" };
  }
}

function latestSeasonalRange(
  preset: Extract<
    DatePresetId,
    | "seasonal_mothers_day"
    | "seasonal_valentines"
    | "seasonal_black_friday"
    | "seasonal_cyber_monday"
    | "seasonal_christmas"
  >,
  ref: Date
): DateRange {
  const y = ref.getFullYear();
  const thisYear = seasonalRangeForYear(preset, y);
  const end = startOfLocalDay(new Date(`${thisYear.to}T12:00:00`));
  if (end <= startOfLocalDay(ref)) return thisYear;
  return seasonalRangeForYear(preset, y - 1);
}

export function resolveDatePresetRange(preset: DatePresetId, ref: Date = new Date()): DateRange {
  const today = startOfLocalDay(ref);
  const yesterday = addDays(today, -1);

  switch (preset) {
    case "today":
      return { from: formatIsoLocal(today), to: formatIsoLocal(today) };
    case "yesterday":
      return { from: formatIsoLocal(yesterday), to: formatIsoLocal(yesterday) };
    case "last_7":
      return { from: formatIsoLocal(addDays(today, -6)), to: formatIsoLocal(today) };
    case "last_14":
      return { from: formatIsoLocal(addDays(today, -13)), to: formatIsoLocal(today) };
    case "last_30":
      return { from: formatIsoLocal(addDays(today, -29)), to: formatIsoLocal(today) };
    case "last_180":
      return { from: formatIsoLocal(addDays(today, -179)), to: formatIsoLocal(today) };
    case "last_90":
      return { from: formatIsoLocal(addDays(today, -89)), to: formatIsoLocal(today) };
    case "last_365":
      return { from: formatIsoLocal(addDays(today, -364)), to: formatIsoLocal(today) };
    case "last_week": {
      const thisMon = mondayOfWeek(today);
      const lastMon = addDays(thisMon, -7);
      const lastSun = addDays(lastMon, 6);
      return { from: formatIsoLocal(lastMon), to: formatIsoLocal(lastSun) };
    }
    case "last_month": {
      const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayPrev = addDays(firstThisMonth, -1);
      const firstPrev = new Date(lastDayPrev.getFullYear(), lastDayPrev.getMonth(), 1);
      return { from: formatIsoLocal(firstPrev), to: formatIsoLocal(lastDayPrev) };
    }
    case "last_quarter": {
      const q = currentQuarter(today);
      const y = today.getFullYear();
      const prevQ = q === 1 ? 4 : ((q - 1) as 1 | 2 | 3 | 4);
      const prevY = q === 1 ? y - 1 : y;
      return {
        from: formatIsoLocal(quarterStart(prevY, prevQ)),
        to: formatIsoLocal(quarterEnd(prevY, prevQ)),
      };
    }
    case "last_12_months":
      return { from: formatIsoLocal(addDays(today, -364)), to: formatIsoLocal(today) };
    case "last_year": {
      const y = today.getFullYear() - 1;
      return {
        from: formatIsoLocal(new Date(y, 0, 1)),
        to: formatIsoLocal(new Date(y, 11, 31)),
      };
    }
    case "wtd":
      return { from: formatIsoLocal(mondayOfWeek(today)), to: formatIsoLocal(today) };
    case "mtd":
      return { from: formatIsoLocal(new Date(today.getFullYear(), today.getMonth(), 1)), to: formatIsoLocal(today) };
    case "qtd": {
      const q = currentQuarter(today);
      return { from: formatIsoLocal(quarterStart(today.getFullYear(), q)), to: formatIsoLocal(today) };
    }
    case "ytd":
      return { from: formatIsoLocal(new Date(today.getFullYear(), 0, 1)), to: formatIsoLocal(today) };
    case "quarter_this": {
      const q = currentQuarter(today);
      const y = today.getFullYear();
      return {
        from: formatIsoLocal(quarterStart(y, q)),
        to: formatIsoLocal(quarterEnd(y, q)),
      };
    }
    case "quarter_q1_2026":
      return { from: "2026-01-01", to: "2026-03-31" };
    case "quarter_q2_2026":
      return { from: "2026-04-01", to: "2026-06-30" };
    case "quarter_q3_2026":
      return { from: "2026-07-01", to: "2026-09-30" };
    case "quarter_q4_2025":
      return { from: "2025-10-01", to: "2025-12-31" };
    case "seasonal_mothers_day":
    case "seasonal_valentines":
    case "seasonal_black_friday":
    case "seasonal_cyber_monday":
    case "seasonal_christmas":
      return latestSeasonalRange(preset, ref);
    default:
      return { from: "", to: "" };
  }
}

export function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function displayDateDdMmYyyy(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function effectiveDateRange(
  preset: DatePreset,
  from: string,
  to: string,
  ref: Date = new Date()
): DateRange | null {
  if (preset) return resolveDatePresetRange(preset, ref);
  if (from || to) {
    return {
      from: from || to,
      to: to || from,
    };
  }
  return null;
}
