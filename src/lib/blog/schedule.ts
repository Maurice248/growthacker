import { shouldRunCampaignNow } from '@/lib/newsletter/timezones';

export function shouldRunBlogToday(
  runHour: number,
  runMinute: number,
  runTimezone: string,
  daysInterval: number,
  lastRunAt: Date | null,
  now = new Date()
): boolean {
  if (!shouldRunCampaignNow(runHour, runMinute, runTimezone, lastRunAt, now)) {
    return false;
  }

  if (!lastRunAt) return true;

  const daysSince = Math.floor((now.getTime() - lastRunAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= Math.max(1, daysInterval);
}

export function isScheduledDayOfMonth(day: number, daysInterval: number): boolean {
  if (daysInterval <= 0) return true;
  return day % daysInterval === 0;
}
