import type { AnalysisCompanyContext } from './company-context';
import { formatBrandContextBlock } from './company-context';

export function buildSystemPrompt(ctx: AnalysisCompanyContext): string {
  const brandBlock = formatBrandContextBlock(ctx);

  return `You are an elite Facebook Ads strategist with deep experience analyzing competitor campaigns on Meta (Facebook & Instagram).

Your job is to analyze real competitor Facebook ad data scraped from the Facebook Ads Library and produce a detailed, actionable intelligence report for ${ctx.companyName} — so their team can create better-performing ads than competitors in this market.

- Ad scores must be on a strict 1–10 scale. 10 is the maximum. Never exceed 10. Round any calculated score to the nearest whole number between 1 and 10.

================================================================
BUSINESS CONTEXT — ${ctx.companyName.toUpperCase()}
================================================================
${brandBlock}

Use this context for all recommendations, ad scripts, hooks, CTAs, and targeting. If a field is empty, infer sensibly from the scraped ads and search keywords — never invent specific prices or product names not supported by the data or brand context above.

================================================================
ANALYSIS RULES
================================================================
- Analyze EVERY competitor provided in the competitors array — include ALL of them, MINIMUM 8 when that many exist in the data
- Ad scripts must use hook patterns from the highest-scoring scraped ads as direct inspiration
- Do NOT write generic hooks — reference specific competitor examples from the data
- Find MINIMUM 5 gap opportunities — never less
- hook_analysis.top_hook_patterns: MINIMUM 4 distinct patterns — derive from top_ads and competitor hooks in the data
- Be honest — if competitor ads are weak, say so with specific evidence from the data
- Always back every insight with a specific example from the input data
- Use plain English — the reader is a business owner, not a marketing academic
- Every recommendation must be immediately actionable for ${ctx.companyName}
- Never fabricate competitor names, metrics, or ad copy not present in the input

================================================================
OUTPUT RULES
================================================================
- Output ONLY valid JSON — no markdown, no backticks, no text outside JSON
- Complete ALL sections — do not truncate or skip any field
- competitor_analysis: include EVERY competitor from the competitors array — MINIMUM 8 when 8+ are provided; never omit competitors that exist in the input
- hook_analysis.top_hook_patterns: MINIMUM 4 entries — each with pattern, exact example hook from data, why_it_works, and score
- market_insights.top_cta_pattern: 2–4 sentences — name the top CTAs from the data (with counts if available), explain why they work, and what ${ctx.companyName} should use
- ready_ad_scripts: include exactly 3–5 scripts — one per main product/service from the business context (or top opportunities from the data if products are unspecified). Vary formats: at least one video reel, one image ad, and one carousel when possible
- gap_opportunities: minimum 5 gaps — never less
- action_plan: exactly 4 steps — 2 in Week 1, 2 in Week 2
- framework_breakdown: include ALL frameworks found in the data
- Each ad script MUST include "competitor_hook_referenced" showing which top ad hook inspired it
- Tailor all scripts to ${ctx.companyName}'s audience, voice, and offerings from the business context

Return ONLY valid JSON. Ensure strict JSON.parse compatibility.

================================================================
HOOK & MARKET INSIGHT QUALITY RULES
================================================================
hook_analysis.top_hook_patterns:
- MINIMUM 4 patterns required — use distinct hook types (cost-savings, fear-removal, trust/proof, urgency, transformation, etc.)
- example must be exact hook text copied from the scraped data
- why_it_works must explain the psychological trigger in plain English (1–2 sentences)

hook_analysis.best_hook_formula:
- Must be a fill-in-the-blank template immediately usable by ${ctx.companyName}
- Format: "[Location] [Audience] — [Specific Benefit + Number] — [Scarcity] — [CTA]"

market_insights.top_cta_pattern:
- Must reference actual CTA text from top_ctas / competitor data
- Explain which CTAs appear most and WHY they convert for this audience
- Be specific — not a single word like "Learn More"; write 2–4 full sentences

================================================================
AD SCRIPT QUALITY RULES
================================================================
- Scripts must be ready to use as-is — no placeholders like [COMPANY] or [PRODUCT]
- Image ad body copy: 50–80 words
- Video scripts: exact timestamps [0-4s], [4-8s], etc.
- Every script must explain why it beats a specific competitor based on the data
- Match the brand voice described in the business context
- CTAs should feel low-commitment and appropriate for the industry`;
}

export function buildUserPrompt(
  ctx: AnalysisCompanyContext,
  gptInput: Record<string, unknown>
): string {
  const topAds = (gptInput.top_ads as Record<string, unknown>[]) || [];
  const provenHooks = topAds.map((a) => ({
    hook: a.hook,
    body: a.body,
    framework: a.framework,
    score: a.score,
  }));

  const brandBlock = formatBrandContextBlock(ctx);
  const marketLabel = ctx.keywords.join(', ') || ctx.topic;
  const competitorCount = ((gptInput.competitors as unknown[]) || []).length;

  return `Here is real Facebook ad data scraped from competitors in the "${marketLabel}" market. Analyze it for ${ctx.companyName} and return a complete report in the exact JSON format specified in your system prompt.

=== BUSINESS CONTEXT ===
${brandBlock}

=== COMPETITOR DATA (${competitorCount} competitors — include ALL in competitor_analysis) ===
${JSON.stringify(gptInput.competitors)}

=== TOP 5 STRONGEST ADS ===
${JSON.stringify(gptInput.top_ads)}

=== MARKET SUMMARY ===
${JSON.stringify(gptInput.summary)}

=== META ===
${JSON.stringify(gptInput.meta)}

=== PROVEN HOOK FORMULAS (highest scoring — use these exact patterns as inspiration) ===
${JSON.stringify(provenHooks)}

=== STRICT OUTPUT RULES — NO EXCEPTIONS ===

1. competitor_analysis: MINIMUM 8 competitors when ${competitorCount} >= 8 — include EVERY competitor present in the competitors array above; analyze angle, format, threat level, and weaknesses ${ctx.companyName} can exploit. Do NOT skip any competitor from the input.

2. hook_analysis.top_hook_patterns: MINIMUM 4 patterns — derive from top_ads hooks and competitor best_hooks; each entry needs pattern, exact example text from data, why_it_works (1–2 sentences), and score

3. market_insights.top_cta_pattern: 2–4 sentences naming the most common CTAs from the data (reference summary.top_ctas counts), explain why they work for this audience, and what ${ctx.companyName} should use. Do NOT return a single short phrase.

4. ready_ad_scripts: 3–5 scripts covering ${ctx.companyName}'s main products/services. Vary formats (video reel, image, carousel). Each must reference and improve upon a competitor hook from top_ads

5. gap_opportunities: MINIMUM 5 gaps

6. action_plan: EXACTLY 4 steps (Week 1: 2, Week 2: 2), each referencing a specific script from ready_ad_scripts with measurable expected outcomes

7. All copy must sound like ${ctx.companyName} — use their brand voice, audience, and offerings from the business context

8. If any section is incomplete, the output will be rejected. No empty strings. No placeholders.

=== END OF DATA ===

Return ONLY valid JSON:

{
  "report_title": "Competitor Ad Intelligence Report — ${ctx.topic} | ${ctx.companyName}",
  "generated_at": "<ISO timestamp>",
  "total_ads_analyzed": <number>,
  "total_competitors": <number>,
  "executive_summary": "<3-4 sentences mentioning dominant format, top competitor angle, and the single biggest opportunity for ${ctx.companyName}>",
  "market_insights": {
    "dominant_ad_format": "<video/image/carousel>",
    "dominant_format_reason": "<why — be specific with numbers from data>",
    "dominant_emotional_angle": "<psychological trigger most ads use>",
    "dominant_script_framework": "<framework name>",
    "avg_copy_length": "<short/medium/long with word range>",
    "top_cta_pattern": "<2-4 sentences: top CTAs from data with counts, why they work, recommendation for ${ctx.companyName}>",
    "key_observation": "<one non-obvious actionable insight>"
  },
  "competitor_analysis": [
    { "page_name": "", "page_url": "", "total_ads": 0, "ad_score": 0, "strategy_summary": "", "what_they_do_well": [], "weaknesses": [], "best_hook": "", "dominant_angle": "", "threat_level": "", "threat_reason": "" },
    { "page_name": "", "page_url": "", "total_ads": 0, "ad_score": 0, "strategy_summary": "", "what_they_do_well": [], "weaknesses": [], "best_hook": "", "dominant_angle": "", "threat_level": "", "threat_reason": "" }
  ],
  "hook_analysis": {
    "top_hook_patterns": [
      { "pattern": "", "example": "", "why_it_works": "", "score": "" },
      { "pattern": "", "example": "", "why_it_works": "", "score": "" },
      { "pattern": "", "example": "", "why_it_works": "", "score": "" },
      { "pattern": "", "example": "", "why_it_works": "", "score": "" }
    ],
    "hooks_to_avoid": [{ "pattern": "", "example": "", "why_it_fails": "" }],
    "best_hook_formula": "<fill-in-the-blank template>"
  },
  "script_framework_analysis": {
    "most_used_framework": "",
    "most_effective_framework": "",
    "framework_breakdown": [{ "framework": "", "count": 0, "avg_score": 0, "when_to_use": "" }]
  },
  "gap_opportunities": [{ "gap": "", "opportunity": "", "ad_format": "", "priority": "", "estimated_impact": "" }],
  "ready_ad_scripts": [
    { "title": "", "format": "video|image|carousel", "script": "", "competitor_hook_referenced": "", "target_audience": "" }
  ],
  "hashtag_strategy": {
    "top_hashtags_from_market": [],
    "recommended_hashtags_for_brand": [],
    "hashtag_usage_tip": ""
  },
  "budget_recommendation": {
    "recommended_daily_budget": "",
    "recommended_duration_days": "",
    "best_platform": "",
    "best_ad_format_to_start": "",
    "audience_targeting": { "age_range": "", "interests": [], "behaviors": [], "locations": "" }
  },
  "action_plan": [{ "priority": 1, "week": "Week 1", "action": "", "format": "", "expected_outcome": "" }]
}`;
}
