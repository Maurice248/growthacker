"use client";

import { NEWSLETTER_TIMEZONES, formatTimezoneLabel, DEFAULT_NEWSLETTER_TIMEZONE } from "@/lib/newsletter/timezones";

export default function TimezoneSelect({
  value,
  onChange,
  className = "nl-select appearance-none pr-10 w-full",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const selected = value || DEFAULT_NEWSLETTER_TIMEZONE;

  return (
    <select value={selected} onChange={(e) => onChange(e.target.value)} className={className}>
      {NEWSLETTER_TIMEZONES.map((tz) => (
        <option key={tz} value={tz}>
          {formatTimezoneLabel(tz)}
        </option>
      ))}
    </select>
  );
}
