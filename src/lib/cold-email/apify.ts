import type { ApifyLeadRow } from './types';

const LEADS_FINDER_ACTOR = 'code_crafter~leads-finder';
const POLL_INTERVAL_MS = 30_000;
const MAX_POLLS = 10;

const COUNTRY_MAP: Record<string, string> = {
  ca: 'canada',
  uae: 'united arab emirates',
  uk: 'united kingdom',
  usa: 'united states',
  us: 'united states',
  ksa: 'saudi arabia',
};

export function buildLeadsFinderInput(niches: string, location: string, maxResults: number) {
  const nicheList = niches
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  const locationParts = location.split(',').map((s) => s.trim().toLowerCase());
  const city = locationParts[0] || '';
  const rawCountry = locationParts[1] || '';
  const country = COUNTRY_MAP[rawCountry] || rawCountry;

  return {
    contact_job_title: nicheList.length ? nicheList : [niches],
    contact_city: city ? [city] : [],
    contact_location: country ? [country] : [],
    email_status: ['validated', 'unknown'],
    fetch_count: Math.min(Math.max(maxResults, 1), 1000),
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLeadsFinderScraper(
  apifyToken: string,
  niches: string,
  location: string,
  maxResults: number
): Promise<ApifyLeadRow[]> {
  const body = buildLeadsFinderInput(niches, location, maxResults);

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${LEADS_FINDER_ACTOR}/runs?token=${encodeURIComponent(apifyToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(150_000),
    }
  );

  if (!startRes.ok) {
    const text = await startRes.text().catch(() => '');
    throw new Error(`Apify start failed HTTP ${startRes.status}: ${text.slice(0, 300)}`);
  }

  const startData = (await startRes.json()) as {
    data?: { id?: string; defaultDatasetId?: string; status?: string };
  };

  const runId = startData.data?.id;
  const datasetId = startData.data?.defaultDatasetId;
  if (!runId || !datasetId) {
    throw new Error('Apify did not return run id or dataset id');
  }

  let status = startData.data?.status || 'RUNNING';
  for (let i = 0; i < MAX_POLLS && status !== 'SUCCEEDED'; i++) {
    await sleep(POLL_INTERVAL_MS);
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(apifyToken)}`,
      { signal: AbortSignal.timeout(30_000) }
    );
    if (!statusRes.ok) continue;
    const statusData = (await statusRes.json()) as { data?: { status?: string } };
    status = statusData.data?.status || status;
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ended with status: ${status}`);
    }
  }

  if (status !== 'SUCCEEDED') {
    throw new Error('Apify scraper timed out waiting for results');
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(apifyToken)}&format=json&limit=10000`,
    { signal: AbortSignal.timeout(60_000) }
  );

  if (!itemsRes.ok) {
    throw new Error(`Apify dataset fetch failed HTTP ${itemsRes.status}`);
  }

  const items = (await itemsRes.json()) as ApifyLeadRow[];
  return Array.isArray(items) ? items : [];
}

export function cleanScrapedLeads(items: ApifyLeadRow[]) {
  const seen = new Set<string>();
  const results: Array<{
    first_name: string;
    last_name: string;
    mobile_number: string;
    personal_email: string;
    linkedin: string;
    city: string;
    country: string;
  }> = [];

  for (const lead of items) {
    let email = '';
    if (lead.personal_email) {
      email = lead.personal_email.trim().toLowerCase();
    } else if (lead.email) {
      email = lead.email.trim().toLowerCase();
    }
    if (!email || !email.includes('@')) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    results.push({
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      mobile_number: lead.mobile_number || '',
      personal_email: email,
      linkedin: lead.linkedin || '',
      city: lead.city || '',
      country: lead.country || '',
    });
  }

  return results;
}
