import { toAiEndpoint, type AiCredential } from '@/lib/ai-endpoint';
import type { AnalysisReport } from './types';
import type { AnalysisCompanyContext } from './company-context';
import { buildSystemPrompt, buildUserPrompt } from './prompts';

const MIN_HOOK_PATTERNS = 4;
const MIN_CTA_PATTERN_LENGTH = 80;

function clampScore(val: unknown) {
  const n = parseFloat(String(val));
  if (isNaN(n)) return val;
  return Math.min(Math.round(n), 10);
}

function safeGet(obj: unknown, ...keys: string[]): unknown {
  let c: unknown = obj;
  for (const k of keys) {
    if (!c || typeof c !== 'object') return null;
    c = (c as Record<string, unknown>)[k];
  }
  return c ?? null;
}

function parseAiOutput(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw !== 'string') {
    throw new Error('AI output is not a string or object');
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    try {
      const parsedString = JSON.parse(raw);
      if (typeof parsedString === 'string') {
        return JSON.parse(parsedString) as Record<string, unknown>;
      }
      return parsedString as Record<string, unknown>;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Parsing failed';
      throw new Error(`AI response parsing failed: ${message}`);
    }
  }
}

function supplementHooksTable(
  hooks: AnalysisReport['hooks_table'],
  gptInput?: Record<string, unknown>
): AnalysisReport['hooks_table'] {
  if (hooks.length >= MIN_HOOK_PATTERNS || !gptInput) return hooks;

  const result = [...hooks];
  const seen = new Set(result.map((h) => h.example.toLowerCase().trim()).filter(Boolean));

  const sources: Array<{ hook?: string; framework?: string; score?: unknown }> = [
    ...((gptInput.top_ads as Record<string, unknown>[]) || []),
    ...((gptInput.competitors as Record<string, unknown>[]) || []).flatMap((c) => {
      const best = c.best_ad as Record<string, unknown> | undefined;
      const hooks = (c.top_hooks as string[]) || [];
      return [
        ...(best?.hook ? [{ hook: String(best.hook), framework: String(best.framework || ''), score: best.score }] : []),
        ...hooks.map((h) => ({ hook: h, framework: String(c.top_framework || ''), score: '' })),
      ];
    }),
  ];

  for (const src of sources) {
    if (result.length >= MIN_HOOK_PATTERNS) break;
    const example = String(src.hook || '').trim();
    if (!example || example.length < 5) continue;
    const key = example.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const framework = String(src.framework || '').trim();
    result.push({
      pattern: framework ? `${framework} hook pattern` : 'High-performing competitor hook',
      example,
      reason: 'Recurs in top-scoring competitor ads — leads with a clear benefit or pain point before the CTA.',
      score: clampScore(src.score || 'moderate') as number | string,
    });
  }

  return result;
}

function enrichCtaPattern(aiValue: string, gptInput?: Record<string, unknown>): string {
  const trimmed = aiValue.trim();
  if (trimmed.length >= MIN_CTA_PATTERN_LENGTH || !gptInput) return trimmed;

  const summary = gptInput.summary as Record<string, unknown> | undefined;
  const topCtas = (summary?.top_ctas as Array<{ val?: string; count?: number }>) || [];
  if (!topCtas.length) return trimmed;

  const ctaList = topCtas
    .slice(0, 5)
    .map((c) => `"${c.val}" (${c.count ?? 0} ads)`)
    .join(', ');

  const lead = `The most common CTAs in this market are ${ctaList}. `;
  if (!trimmed) {
    return `${lead}These low-commitment action phrases reduce friction and match what competitors use on their highest-impression ads.`;
  }

  return `${lead}${trimmed}`;
}

export function formatAnalysisReport(
  rawOutput: unknown,
  topic?: string,
  gptInput?: Record<string, unknown>
): AnalysisReport {
  const p = parseAiOutput(rawOutput);

  let hooks_table = (
    ((safeGet(p, 'hook_analysis', 'top_hook_patterns') || []) as Record<string, unknown>[]) || []
  ).map((h) => ({
    pattern: String(h.pattern || ''),
    example: String(h.example || ''),
    reason: String(h.why_it_works || ''),
    score: clampScore(h.score || '') as number | string,
  }));

  hooks_table = supplementHooksTable(hooks_table, gptInput);

  const rawCta = String(safeGet(p, 'market_insights', 'top_cta_pattern') || '');

  return {
    success: true,
    topic,
    executive_summary: String(p.executive_summary || ''),

    competitors_table: ((p.competitor_analysis || []) as Record<string, unknown>[]).map((c) => ({
      name: String(c.page_name || ''),
      ads: Number(c.total_ads || 0),
      score: clampScore(c.ad_score || 0) as number | string,
      threat: String(c.threat_level || ''),
      angle: String(c.dominant_angle || ''),
      hook: String(c.best_hook || ''),
    })),

    hooks_table,

    market_insights_table: [
      { field: 'Format', value: String(safeGet(p, 'market_insights', 'dominant_ad_format') || '') },
      { field: 'Angle', value: String(safeGet(p, 'market_insights', 'dominant_emotional_angle') || '') },
      { field: 'Framework', value: String(safeGet(p, 'market_insights', 'dominant_script_framework') || '') },
      {
        field: 'CTA Pattern',
        value: enrichCtaPattern(rawCta, gptInput),
      },
    ],

    gaps_table: ((p.gap_opportunities || []) as Record<string, unknown>[]).map((g) => ({
      gap: String(g.gap || ''),
      opportunity: String(g.opportunity || ''),
      priority: String(g.priority || ''),
      impact: String(g.estimated_impact || ''),
      ad_format: String(g.ad_format || ''),
    })),

    ready_ad_scripts: ((p.ready_ad_scripts || []) as Record<string, unknown>[]).map((s) => ({
      title: String(s.title || ''),
      format: String(s.format || s.ad_format || s.type || ''),
      script: String(s.script || s.idea || s.storyboard || s.text || s.narrative || ''),
      competitor_hook_referenced: String(s.competitor_hook_referenced || ''),
      target_audience: String(s.target_audience || ''),
    })),

    action_plan: ((p.action_plan || []) as Record<string, unknown>[]).map((a) => ({
      priority: Number(a.priority) || undefined,
      week: String(a.week || ''),
      action: String(a.action || ''),
      format: String(a.format || ''),
      expected_outcome: String(a.expected_outcome || ''),
    })),

    budget_recommendation: {
      best_ad_format_to_start: String(
        safeGet(p, 'budget_recommendation', 'best_ad_format_to_start') || ''
      ),
      recommended_daily_budget: String(
        safeGet(p, 'budget_recommendation', 'recommended_daily_budget') || ''
      ),
      recommended_duration_days: String(
        safeGet(p, 'budget_recommendation', 'recommended_duration_days') || ''
      ),
      best_platform: String(safeGet(p, 'budget_recommendation', 'best_platform') || ''),
    },
  };
}

export async function analyzeWithOpenAI(
  credential: AiCredential,
  gptInput: Record<string, unknown>,
  companyContext: AnalysisCompanyContext
) {
  const endpoint = toAiEndpoint(credential);
  const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${endpoint.apiKey}`,
    },
    body: JSON.stringify({
      model: endpoint.model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(companyContext) },
        { role: 'user', content: buildUserPrompt(companyContext, gptInput) },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${text.slice(0, 200)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty response');
  }

  return content;
}
