const COMMON_TIMEZONES = [
  'UTC',
  'America/St_Johns',
  'America/Halifax',
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Helsinki',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
];

const INSTANCE_DEFAULT_TIMEZONE = '__instance_default__';

export function getTimezoneOptions(): string[] {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      return (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
        'timeZone'
      );
    } catch {
      // fall through
    }
  }
  return COMMON_TIMEZONES;
}

export function formatTimezoneLabel(timezone: string): string {
  if (!timezone || timezone === INSTANCE_DEFAULT_TIMEZONE) return 'Instance default (server)';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    const label = timezone.replace(/_/g, ' ');
    return offset ? `${label} (${offset})` : label;
  } catch {
    return timezone.replace(/_/g, ' ');
  }
}

export function buildTimezoneSelectOptions(currentTimezone: string | null): Array<{ value: string; label: string }> {
  const options = getTimezoneOptions();
  const values = new Set<string>([INSTANCE_DEFAULT_TIMEZONE, ...options]);
  if (currentTimezone) values.add(currentTimezone);

  return [...values]
    .sort((a, b) => {
      if (a === INSTANCE_DEFAULT_TIMEZONE) return -1;
      if (b === INSTANCE_DEFAULT_TIMEZONE) return 1;
      return formatTimezoneLabel(a).localeCompare(formatTimezoneLabel(b));
    })
    .map((value) => ({
      value,
      label: formatTimezoneLabel(value),
    }));
}

export function toTimezoneSelectValue(timezone: string | null | undefined): string {
  return timezone?.trim() ? timezone.trim() : INSTANCE_DEFAULT_TIMEZONE;
}

export function fromTimezoneSelectValue(value: string): string {
  return value === INSTANCE_DEFAULT_TIMEZONE ? '' : value;
}
