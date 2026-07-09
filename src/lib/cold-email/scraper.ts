import { prisma } from '@/lib/prisma';
import { runLeadsFinderScraper, cleanScrapedLeads } from './apify';
import { verifyEmailsBatch } from './verify';
import { resolveLeadListId } from './config';
import { getColdEmailTokens, requireToken } from './tokens';
import type { ScraperInput, ScraperResult } from './types';

export async function runLeadScraper(
  companyId: string,
  input: ScraperInput,
  executionId: string
): Promise<ScraperResult> {
  const startTime = Date.now();
  const tokens = await getColdEmailTokens(companyId);
  const apifyKey = requireToken(tokens, 'apify', 'Apify');
  const verifierKey = requireToken(tokens, 'millionVerifier', 'Million Verifier');

  const listRef = await resolveLeadListId(
    companyId,
    input.list_id || input.target_sheet
  );
  if (!listRef) {
    throw new Error(
      `Lead list not found: "${input.target_sheet}". Create a list in Cold Email settings first.`
    );
  }

  const rawItems = await runLeadsFinderScraper(
    apifyKey,
    input.niches,
    input.location,
    input.max_results
  );

  const cleaned = cleanScrapedLeads(rawItems);
  const totalScraped = cleaned.length;

  const verificationMap = await verifyEmailsBatch(
    verifierKey,
    cleaned.map((l) => l.personal_email)
  );

  const statusCounts = { verified: 0, catch_all: 0, invalid: 0, unknown: 0 };
  let savedCount = 0;

  for (const lead of cleaned) {
    const emailStatus = verificationMap.get(lead.personal_email) || 'unknown';
    if (emailStatus in statusCounts) {
      statusCounts[emailStatus as keyof typeof statusCounts]++;
    }

    if (emailStatus !== 'verified') continue;

    try {
      await prisma.outreachLead.upsert({
        where: {
          companyId_email: { companyId, email: lead.personal_email },
        },
        create: {
          companyId,
          listId: listRef.id,
          firstName: lead.first_name,
          lastName: lead.last_name,
          email: lead.personal_email,
          mobileNumber: lead.mobile_number.replace(/[-\s().+]/g, ''),
          linkedin: lead.linkedin,
          city: lead.city,
          country: lead.country,
          emailStatus: 'verified',
          isCatchAll: false,
          sentStatus: 'not_sent',
          source: 'apify',
        },
        update: {
          listId: listRef.id,
          firstName: lead.first_name,
          lastName: lead.last_name,
          mobileNumber: lead.mobile_number.replace(/[-\s().+]/g, ''),
          linkedin: lead.linkedin,
          city: lead.city,
          country: lead.country,
          emailStatus: 'verified',
        },
      });
      savedCount++;
    } catch (err) {
      console.warn('[cold-email/scraper] failed to save lead:', lead.personal_email, err);
    }
  }

  const bounceRiskRemoved = statusCounts.catch_all + statusCounts.invalid + statusCounts.unknown;
  const successRate =
    totalScraped > 0
      ? `${Math.round((statusCounts.verified / totalScraped) * 100)}%`
      : '0%';

  return {
    status: 'success',
    execution_id: executionId,
    timestamp: new Date().toISOString(),
    execution_time_seconds: Math.round((Date.now() - startTime) / 1000),
    supabase_info: {
      table_name: listRef.name,
      total_leads_requested: input.max_results,
      total_leads_scraped: totalScraped,
      save_status: savedCount > 0 ? 'success' : 'no_leads_saved',
    },
    email_verification_stats: {
      verified: statusCounts.verified,
      catch_all: statusCounts.catch_all,
      invalid: statusCounts.invalid,
      unknown: statusCounts.unknown,
      bounce_risk_removed: bounceRiskRemoved,
    },
    scraper_summary: {
      niches: input.niches,
      location: input.location,
      total_scraped: totalScraped,
      verified_leads: statusCounts.verified,
      invalid_leads: statusCounts.invalid,
      unknown_leads: statusCounts.unknown + statusCounts.catch_all,
      success_rate: successRate,
    },
  };
}
