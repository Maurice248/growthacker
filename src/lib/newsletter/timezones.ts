export const DEFAULT_NEWSLETTER_TIMEZONE = 'UTC';

export const NEWSLETTER_TIMEZONES = [
  'UTC',
  'America/St_Johns',
  'America/Halifax',
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Manila',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export type NewsletterTimezone = (typeof NEWSLETTER_TIMEZONES)[number];

export function normalizeTimezone(value: string | null | undefined): string {
  const tz = (value || '').trim();
  if (!tz) return DEFAULT_NEWSLETTER_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_NEWSLETTER_TIMEZONE;
  }
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const tz = normalizeTimezone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value || '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24,
    minute: read('minute'),
  };
}

export function isSameZonedDay(a: Date, b: Date, timeZone: string): boolean {
  const pa = getZonedParts(a, timeZone);
  const pb = getZonedParts(b, timeZone);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function shouldRunCampaignNow(
  sendHour: number,
  sendMinute: number,
  timeZone: string,
  lastRunAt: Date | null,
  now = new Date()
): boolean {
  const tz = normalizeTimezone(timeZone);

  if (lastRunAt && isSameZonedDay(lastRunAt, now, tz)) {
    return false;
  }

  const { hour, minute } = getZonedParts(now, tz);
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = sendHour * 60 + sendMinute;
  return currentMinutes >= targetMinutes;
}

export function formatTimezoneLabel(timeZone: string): string {
  const tz = normalizeTimezone(timeZone);
  if (tz === 'UTC') return 'UTC (Coordinated Universal Time)';

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const offset =
      formatter
        .formatToParts(now)
        .find((p) => p.type === 'timeZoneName')
        ?.value?.replace('GMT', 'UTC') || '';
    const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
    return `${city} (${offset || tz})`;
  } catch {
    return tz;
  }
}
