import { createClient } from '@supabase/supabase-js';
import { getCompanyApiTokenSecrets } from '@/lib/api-token-secrets';
import { resolveModuleAi } from '@/lib/ai-routing-runtime';
import { resolveApifyActorId } from './apify-actors';
import { scrapeFacebookAds } from './apify';
import { analyzeWithOpenAI, formatAnalysisReport } from './analyze';
import {
  buildRelevanceTerms,
  resolveAnalysisCompanyContext,
} from './company-context';
import { processScrapedAds, trimForGptInput } from './process-ads';
import { saveScrapedAds } from './save-ads';
import type { AnalysisReport, CompetitorAnalysisInput } from './types';

export type { AnalysisReport, CompetitorAnalysisInput } from './types';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getAnalysisTokens(companyId: string) {
  const secrets = await getCompanyApiTokenSecrets(companyId);
  return {
    apify: secrets.apify?.trim() || null,
    openai: secrets.openai?.trim() || null,
  };
}

export async function runCompetitorAnalysis(
  companyId: string,
  input: CompetitorAnalysisInput
): Promise<AnalysisReport> {
  const secrets = await getCompanyApiTokenSecrets(companyId);
  const tokens = {
    apify: secrets.apify?.trim() || null,
    openai: secrets.openai?.trim() || null,
  };

  if (!tokens.apify) {
    return {
      success: false,
      executive_summary: '',
      competitors_table: [],
      hooks_table: [],
      market_insights_table: [],
      gaps_table: [],
      error: 'Apify API token is not configured. Add it in Settings → Integrations → Apify.',
    };
  }

  if (!input.keywords?.length) {
    return {
      success: false,
      executive_summary: '',
      competitors_table: [],
      hooks_table: [],
      market_insights_table: [],
      gaps_table: [],
      error: 'At least one keyword is required.',
    };
  }

  if (!input.countries?.length) {
    return {
      success: false,
      executive_summary: '',
      competitors_table: [],
      hooks_table: [],
      market_insights_table: [],
      gaps_table: [],
      error: 'At least one country is required.',
    };
  }

  const scrapeImage = input.scrape_image !== false;
  const scrapeVideo = input.scrape_video !== false;
  if (!scrapeImage && !scrapeVideo) {
    return {
      success: false,
      executive_summary: '',
      competitors_table: [],
      hooks_table: [],
      market_insights_table: [],
      gaps_table: [],
      error: 'Select at least one ad format to scrape (image or video).',
    };
  }

  const analysisInput: CompetitorAnalysisInput = {
    ...input,
    apify_actor: resolveApifyActorId(secrets.competitorApifyActor),
  };

  const companyContext = await resolveAnalysisCompanyContext(companyId, analysisInput);
  const topic = companyContext.topic;
  const relevanceTerms = buildRelevanceTerms(companyContext);

  const scraped = await scrapeFacebookAds(tokens.apify, analysisInput);
  const processed = processScrapedAds(scraped, relevanceTerms);

  if (processed.meta.total_relevant === 0) {
    return {
      success: false,
      topic,
      executive_summary: '',
      competitors_table: [],
      hooks_table: [],
      market_insights_table: [],
      gaps_table: [],
      error: `No relevant ads found for keywords: ${input.keywords.join(', ')}. Try different keywords or countries.`,
    };
  }

  try {
    await saveScrapedAds(companyId, processed, input);
  } catch (err) {
    console.error('[competitor-analysis] saveScrapedAds failed:', err);
  }

  const gptInput = trimForGptInput(processed);

  let ai;
  try {
    ai = await resolveModuleAi(companyId, 'metaAds', tokens.openai);
  } catch (err) {
    return {
      success: false,
      topic,
      executive_summary: '',
      competitors_table: [],
      hooks_table: [],
      market_insights_table: [],
      gaps_table: [],
      error: err instanceof Error ? err.message : 'AI provider is not configured.',
    };
  }

  const aiRaw = await analyzeWithOpenAI(ai, gptInput, companyContext);
  const report = formatAnalysisReport(aiRaw, topic, gptInput);

  await saveReportToSupabase(companyId, report, { ...input, topic, company_id: companyId });

  return report;
}

async function saveReportToSupabase(
  companyId: string,
  report: AnalysisReport,
  inputs: Record<string, unknown>
) {
  const supabase = getServiceClient();
  const { error } = await supabase.from('reports_json').insert({
    report_data: report,
    inputs,
    company_id: companyId,
  });

  if (error) {
    console.error('[competitor-analysis] Supabase insert failed:', error.message);
  }
}
