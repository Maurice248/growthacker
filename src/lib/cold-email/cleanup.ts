import { prisma } from '@/lib/prisma';
import { resolveOutreachContext } from './company-context';
import { getOutreachConfig } from './config';
import { bulkDeleteLeadsFromInstantly } from './instantly';
import { getColdEmailTokens, requireToken } from './tokens';

export type CleanupResult = {
  status: 'success' | 'skipped' | 'error';
  message: string;
  cleanup_date: string;
  deleted_from_instantly: number;
  emails_processed: number;
  instantly_success: boolean;
};

export async function runCleanup(
  companyId: string,
  options: { force?: boolean } = {}
): Promise<CleanupResult> {
  const tokens = await getColdEmailTokens(companyId);
  const instantlyKey = requireToken(tokens, 'instantly', 'Instantly.ai');
  const ctx = await resolveOutreachContext(companyId);
  const config = await getOutreachConfig(companyId);

  const instantlyCampaignId = ctx.instantlyCampaignId;
  if (!instantlyCampaignId) {
    throw new Error(
      'Instantly campaign ID is not configured. Set it in Cold Email settings.'
    );
  }

  const batchSize = config?.cleanupBatchSize ?? 100;

  const sentLeads = await prisma.outreachLead.findMany({
    where: { companyId, sentStatus: 'sent' },
    orderBy: { sentAt: 'asc' },
    take: batchSize,
  });

  if (sentLeads.length === 0) {
    return {
      status: 'skipped',
      message: 'No sent leads found. Nothing to delete from Instantly.',
      cleanup_date: new Date().toISOString(),
      deleted_from_instantly: 0,
      emails_processed: 0,
      instantly_success: true,
    };
  }

  const emails = sentLeads
    .map((l) => l.email)
    .filter((e) => e && e.includes('@'));

  const deleteResult = await bulkDeleteLeadsFromInstantly(
    instantlyKey,
    instantlyCampaignId,
    emails
  );

  if (deleteResult.success) {
    await prisma.outreachLead.updateMany({
      where: {
        companyId,
        email: { in: emails },
      },
      data: { sentStatus: 'not_sent', sentAt: null },
    });
  }

  return {
    status: deleteResult.success ? 'success' : 'error',
    message: deleteResult.success
      ? `${deleteResult.deleted} leads removed from Instantly.ai`
      : `Instantly cleanup failed: ${deleteResult.error}`,
    cleanup_date: new Date().toISOString(),
    deleted_from_instantly: deleteResult.deleted,
    emails_processed: emails.length,
    instantly_success: deleteResult.success,
  };
}

export async function runCleanupForAllCompanies(): Promise<
  Array<{ companyId: string; result: CleanupResult }>
> {
  const configs = await prisma.outreachConfig.findMany({
    where: { active: true },
    select: { companyId: true },
  });

  const results: Array<{ companyId: string; result: CleanupResult }> = [];

  for (const { companyId } of configs) {
    try {
      const result = await runCleanup(companyId);
      results.push({ companyId, result });
    } catch (err) {
      results.push({
        companyId,
        result: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Cleanup failed',
          cleanup_date: new Date().toISOString(),
          deleted_from_instantly: 0,
          emails_processed: 0,
          instantly_success: false,
        },
      });
    }
  }

  return results;
}
