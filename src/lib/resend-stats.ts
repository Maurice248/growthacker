import type { SupabaseClient } from '@supabase/supabase-js';

const CHART_EVENT_TYPES = new Set(['delivered', 'bounced', 'suppressed', 'opened', 'clicked']);

const RESEND_TYPE_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'suppressed',
  'email.suppressed': 'suppressed',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  delivered: 'delivered',
  bounced: 'bounced',
  suppressed: 'suppressed',
  opened: 'opened',
  clicked: 'clicked',
};

export type ResendChartPoint = {
  date: string;
  ts: number;
  delivered?: number;
  bounced?: number;
  suppressed?: number;
  opened?: number;
  clicked?: number;
};

type ResendEventRow = {
  event_type: string;
  created_at: string;
};

function normalizeEventType(raw: string): string | null {
  const mapped = RESEND_TYPE_MAP[raw] ?? RESEND_TYPE_MAP[raw.toLowerCase()];
  if (mapped && CHART_EVENT_TYPES.has(mapped)) return mapped;
  const stripped = raw.replace(/^email\./, '').toLowerCase();
  return CHART_EVENT_TYPES.has(stripped) ? stripped : null;
}

function formatChartLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dayTimestamp(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function aggregateEvents(events: ResendEventRow[]): ResendChartPoint[] {
  const byDay = new Map<string, ResendChartPoint>();

  for (const event of events) {
    const type = normalizeEventType(event.event_type);
    if (!type || !event.created_at) continue;

    const key = dayKey(event.created_at);
    let point = byDay.get(key);
    if (!point) {
      const ts = dayTimestamp(event.created_at);
      point = { date: formatChartLabel(new Date(ts)), ts };
      byDay.set(key, point);
    }
    point[type] = (point[type] ?? 0) + 1;
  }

  return Array.from(byDay.values()).sort((a, b) => a.ts - b.ts);
}

async function fetchAllResendEvents(supabase: SupabaseClient, days?: number): Promise<ResendEventRow[]> {
  const pageSize = 1000;
  const rows: ResendEventRow[] = [];
  let from = 0;

  let cutoff: Date | null = null;
  if (days) {
    cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
    cutoff.setUTCHours(0, 0, 0, 0);
  }

  while (true) {
    let query = supabase
      .from('resend_events')
      .select('event_type, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (cutoff) {
      query = query.gte('created_at', cutoff.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;

    rows.push(...(data as ResendEventRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchResendEventsFromApi(apiKey: string, days?: number): Promise<ResendEventRow[]> {
  if (!apiKey) return [];

  const rows: ResendEventRow[] = [];
  let cursor: string | undefined;
  let cutoff: Date | null = null;

  if (days) {
    cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
    cutoff.setUTCHours(0, 0, 0, 0);
  }

  for (let page = 0; page < 50; page++) {
    const url = new URL('https://api.resend.com/events');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('after', cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend API error (${res.status}): ${body || res.statusText}`);
    }

    const json = (await res.json()) as {
      data?: Array<{ type?: string; created_at?: string }>;
      has_more?: boolean;
    };

    const batch = json.data ?? [];
    if (!batch.length) break;

    for (const event of batch) {
      if (!event.type || !event.created_at) continue;
      if (cutoff && new Date(event.created_at) < cutoff) continue;
      rows.push({ event_type: event.type, created_at: event.created_at });
    }

    if (!json.has_more) break;
    cursor = batch[batch.length - 1]?.created_at;
    if (!cursor) break;
  }

  return rows;
}

export async function getResendStats(
  supabase: SupabaseClient,
  days?: number,
  resendApiKey?: string | null
): Promise<{ chartData: ResendChartPoint[] }> {
  let events = await fetchAllResendEvents(supabase, days);

  if (events.length === 0) {
    const key = resendApiKey?.trim() || process.env.RESEND_API_KEY || '';
    events = await fetchResendEventsFromApi(key, days);
  }

  return { chartData: aggregateEvents(events) };
}
