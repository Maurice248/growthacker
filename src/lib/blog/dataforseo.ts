import { normalizeDataForSeoCredential } from '@/lib/dataforseo-credentials';

const DATAFORSEO_URL =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live';

export type RankedKeyword = {
  keyword: string;
  keywordLower: string;
  keywordType: 'short-tail' | 'medium-tail' | 'long-tail';
  score: number;
  metrics: {
    effectiveSV: number;
    clickstreamSV: number;
    adsSV: number;
    cpc: number;
    competition: number;
    competitionLevel: string;
    keywordDifficulty: number | null;
    wordsCount: number;
    intent: string;
  };
};

type DataForSeoTask = {
  data?: { keyword?: string };
  result?: Array<{
    seed_keyword?: string;
    items?: Array<Record<string, unknown>>;
  }>;
};

const CONFIG = {
  totalOverall: 100,
  perSeedTop: 25,
  minEffectiveSV: 10,
  minAdsSV: 20,
  minScore: 15,
  mix: { short: 10, medium: 30, long: 60 },
  preferClickstream: true,
};

function norm(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getKeywordType(wordsCount: number): RankedKeyword['keywordType'] {
  if (wordsCount <= 2) return 'short-tail';
  if (wordsCount <= 4) return 'medium-tail';
  return 'long-tail';
}

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function scoreKeyword(args: {
  effectiveSV: number;
  adsSV: number;
  cpc: number;
  competition: number;
  competitionLevel: string;
  kd: number;
  intent: string;
}) {
  const { effectiveSV, adsSV, cpc, competition, competitionLevel, kd, intent } = args;
  const volBase = CONFIG.preferClickstream ? effectiveSV : adsSV;
  const volumeScore = Math.min(40, (Math.log10(volBase + 1) / Math.log10(8000)) * 40);

  let compScore = 12;
  if (competitionLevel === 'LOW') compScore = 20;
  else if (competitionLevel === 'MEDIUM') compScore = 14;
  else if (competitionLevel === 'HIGH') compScore = 7;
  else compScore = Math.max(0, 20 - safeNum(competition) * 20);

  const kdSafe = kd > 0 ? kd : 35;
  const diffScore = Math.max(0, 20 - kdSafe / 7);

  let intentScore = 8;
  if (intent === 'informational') intentScore = 15;
  else if (intent === 'commercial') intentScore = 12;
  else if (intent === 'transactional') intentScore = 10;
  else if (intent === 'navigational') intentScore = 6;

  const cpcScore = Math.min(5, (safeNum(cpc) / 2) * 5);
  return Math.round(volumeScore + compScore + diffScore + intentScore + cpcScore);
}

function buildAuthHeader(credential: string): string {
  const normalized = normalizeDataForSeoCredential(credential);
  if (normalized.includes(':')) {
    return `Basic ${Buffer.from(normalized).toString('base64')}`;
  }
  return `Basic ${Buffer.from(`${normalized}:`).toString('base64')}`;
}

export async function fetchKeywordSuggestions(
  credential: string,
  keyword: string,
  locationCode: number
): Promise<DataForSeoTask[]> {
  const res = await fetch(DATAFORSEO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(credential),
    },
    body: JSON.stringify([
      {
        keyword,
        location_code: locationCode,
        language_code: 'en',
        include_serp_info: true,
        include_seed_keyword: true,
        include_clickstream_data: true,
        limit: 100,
      },
    ]),
    signal: AbortSignal.timeout(120_000),
  });

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'DataForSEO authentication failed. In Integrations, set your account login (email) and API password from https://app.dataforseo.com/api-access.'
      );
    }
    throw new Error(`DataForSEO HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const parsed = JSON.parse(text) as { tasks?: DataForSeoTask[] };
  return parsed.tasks ?? [];
}

export function rankKeywords(tasks: DataForSeoTask[]): RankedKeyword[] {
  const dedupeMap = new Map<string, RankedKeyword>();

  for (const task of tasks) {
    const items = task?.result?.[0]?.items || [];
    for (const it of items) {
      const keyword = String(it?.keyword || '');
      if (!keyword) continue;

      const keywordLower = norm(keyword);
      const clickstreamSV = safeNum(
        (it?.clickstream_keyword_info as Record<string, unknown>)?.search_volume,
        0
      );
      const adsSV = safeNum((it?.keyword_info as Record<string, unknown>)?.search_volume, 0);
      const effectiveSV =
        CONFIG.preferClickstream && clickstreamSV > 0 ? clickstreamSV : adsSV;

      const wordsCount = safeNum(
        (it?.keyword_properties as Record<string, unknown>)?.words_count,
        keyword.split(/\s+/).length
      );
      const keywordType = getKeywordType(wordsCount);

      if (effectiveSV < CONFIG.minEffectiveSV && adsSV < CONFIG.minAdsSV) continue;

      const keywordInfo = (it?.keyword_info as Record<string, unknown>) || {};
      const cpc = safeNum(keywordInfo.cpc, 0);
      const competition = safeNum(keywordInfo.competition, 0);
      const competitionLevel = String(keywordInfo.competition_level || 'UNKNOWN');
      const kd = safeNum((it?.keyword_properties as Record<string, unknown>)?.keyword_difficulty, 0);
      const intent = String(
        (it?.search_intent_info as Record<string, unknown>)?.main_intent || 'unknown'
      );

      const score = scoreKeyword({
        effectiveSV,
        adsSV,
        cpc,
        competition,
        competitionLevel,
        kd,
        intent,
      });
      if (score < CONFIG.minScore) continue;

      const obj: RankedKeyword = {
        keyword,
        keywordLower,
        keywordType,
        score,
        metrics: {
          effectiveSV,
          clickstreamSV,
          adsSV,
          cpc: Math.round(cpc * 100) / 100,
          competition: Math.round(competition * 100) / 100,
          competitionLevel,
          keywordDifficulty: kd || null,
          wordsCount,
          intent,
        },
      };

      const existing = dedupeMap.get(keywordLower);
      if (!existing || obj.score > existing.score) {
        dedupeMap.set(keywordLower, obj);
      }
    }
  }

  const merged = Array.from(dedupeMap.values()).sort((a, b) => b.score - a.score);
  const short = merged.filter((k) => k.keywordType === 'short-tail');
  const medium = merged.filter((k) => k.keywordType === 'medium-tail');
  const long = merged.filter((k) => k.keywordType === 'long-tail');

  const selected = [
    ...short.slice(0, CONFIG.mix.short),
    ...medium.slice(0, CONFIG.mix.medium),
    ...long.slice(0, CONFIG.mix.long),
  ];

  if (selected.length < CONFIG.totalOverall) {
    const selectedSet = new Set(selected.map((k) => k.keywordLower));
    const remaining = merged.filter((k) => !selectedSet.has(k.keywordLower));
    selected.push(...remaining.slice(0, CONFIG.totalOverall - selected.length));
  }

  return selected.slice(0, CONFIG.totalOverall).sort((a, b) => b.score - a.score);
}

export async function researchKeywordsForSeeds(
  credential: string,
  seeds: string[],
  locationCode: number,
  maxSeeds = 5
): Promise<RankedKeyword[]> {
  const limited = seeds.slice(0, maxSeeds);
  const allTasks: DataForSeoTask[] = [];

  for (const seed of limited) {
    const tasks = await fetchKeywordSuggestions(credential, seed, locationCode);
    allTasks.push(...tasks);
  }

  return rankKeywords(allTasks);
}
