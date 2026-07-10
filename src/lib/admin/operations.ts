import { prisma } from '@/lib/prisma';

export type NormalizedOperationStatus = 'success' | 'failed' | 'pending' | 'other';

export type AdminOperationEvent = {
  id: string;
  sourceType: 'workflow' | 'social' | 'blog' | 'newsletter';
  module: string;
  label: string;
  companyId: string | null;
  companyName: string | null;
  status: string;
  normalizedStatus: NormalizedOperationStatus;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  detail: Record<string, unknown>;
};

export type OperationsSummary = {
  total24h: number;
  total7d: number;
  failed24h: number;
  failed7d: number;
  pending: number;
};

export function normalizeOperationStatus(
  status: string,
  error?: string | null
): NormalizedOperationStatus {
  if (error?.trim()) return 'failed';

  const s = status.toLowerCase();
  if (
    s.includes('fail') ||
    s.includes('error') ||
    s === 'failed' ||
    s === 'aborted' ||
    s === 'rejected'
  ) {
    return 'failed';
  }
  if (
    s === 'success' ||
    s === 'done' ||
    s === 'completed' ||
    s === 'sent' ||
    s.includes('posted') ||
    s.includes('ready for review') ||
    s.includes('ready')
  ) {
    return 'success';
  }
  if (
    s === 'pending' ||
    s === 'pending_approval' ||
    s.includes('generating') ||
    s.includes('polling') ||
    s.includes('stitch') ||
    s.includes('writing') ||
    s.includes('keywords') ||
    s.includes('image') ||
    s.includes('publishing') ||
    s === 'active'
  ) {
    return 'pending';
  }
  return 'other';
}

function workflowModuleLabel(workflowType: string): string {
  const map: Record<string, string> = {
    CAMPAIGN: 'Cold Email',
    SCRAPER: 'Cold Email',
    CLEANUP: 'Cold Email',
    NEWSLETTER: 'Newsletter',
    SOCIAL: 'Social Channels',
    BLOG: 'Blog',
    META: 'Meta Ads',
  };
  return map[workflowType.toUpperCase()] ?? workflowType;
}

function withinWindow(iso: string, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
}

export function summarizeOperations(events: AdminOperationEvent[]): OperationsSummary {
  const last24h = events.filter((e) => withinWindow(e.createdAt, 1));
  const last7d = events.filter((e) => withinWindow(e.createdAt, 7));

  return {
    total24h: last24h.length,
    total7d: last7d.length,
    failed24h: last24h.filter((e) => e.normalizedStatus === 'failed').length,
    failed7d: last7d.filter((e) => e.normalizedStatus === 'failed').length,
    pending: events.filter((e) => e.normalizedStatus === 'pending').length,
  };
}

export type FetchOperationsOptions = {
  companyId?: string | null;
  module?: string | null;
  status?: NormalizedOperationStatus | null;
  limit?: number;
};

export async function fetchAdminOperations(
  options: FetchOperationsOptions = {}
): Promise<AdminOperationEvent[]> {
  const perSource = Math.max(25, Math.min(options.limit ?? 100, 200));
  const companyFilter = options.companyId ? { companyId: options.companyId } : {};

  const [workflows, socialJobs, blogJobs, newsletterSends] = await Promise.all([
    prisma.workflowExecution.findMany({
      where: companyFilter,
      orderBy: { createdAt: 'desc' },
      take: perSource,
      include: {
        company: { select: { id: true, name: true } },
        campaign: { select: { id: true, campaignName: true, status: true } },
        scraperJob: { select: { id: true, location: true, totalScraped: true } },
        cleanupLog: { select: { id: true, deletedCount: true } },
      },
    }),
    prisma.socialStudioJob.findMany({
      where: companyFilter,
      orderBy: { createdAt: 'desc' },
      take: perSource,
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.blogJob.findMany({
      where: companyFilter,
      orderBy: { createdAt: 'desc' },
      take: perSource,
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.newsletterSend.findMany({
      where: options.companyId
        ? { campaign: { companyId: options.companyId } }
        : {},
      orderBy: { sentAt: 'desc' },
      take: perSource,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
        subscriber: { select: { email: true } },
      },
    }),
  ]);

  const events: AdminOperationEvent[] = [];

  for (const w of workflows) {
    const label =
      w.workflowName ??
      w.campaign?.campaignName ??
      w.scraperJob?.location ??
      (w.cleanupLog ? `Cleanup (${w.cleanupLog.deletedCount} deleted)` : w.workflowType);

    events.push({
      id: `workflow-${w.id}`,
      sourceType: 'workflow',
      module: workflowModuleLabel(w.workflowType),
      label,
      companyId: w.companyId,
      companyName: w.company?.name ?? null,
      status: w.status,
      normalizedStatus: normalizeOperationStatus(w.status, w.errorMessage),
      durationMs: w.duration,
      error: w.errorMessage,
      createdAt: w.createdAt.toISOString(),
      detail: {
        workflowType: w.workflowType,
        workflowName: w.workflowName,
        inputData: w.inputData?.slice(0, 2000) ?? null,
        outputData: w.outputData?.slice(0, 2000) ?? null,
        campaignStatus: w.campaign?.status ?? null,
        scraperTotal: w.scraperJob?.totalScraped ?? null,
      },
    });
  }

  for (const j of socialJobs) {
    events.push({
      id: `social-${j.id}`,
      sourceType: 'social',
      module: 'Social Channels',
      label: `${j.kind} job`,
      companyId: j.companyId,
      companyName: j.company.name,
      status: j.status,
      normalizedStatus: normalizeOperationStatus(j.status, j.error),
      durationMs: null,
      error: j.error,
      createdAt: j.createdAt.toISOString(),
      detail: {
        kind: j.kind,
        assetUrl: j.assetUrl,
        story: j.story?.slice(0, 500) ?? null,
        input: j.input,
      },
    });
  }

  for (const j of blogJobs) {
    events.push({
      id: `blog-${j.id}`,
      sourceType: 'blog',
      module: 'Blog',
      label: j.title ?? 'Blog generation',
      companyId: j.companyId,
      companyName: j.company.name,
      status: j.status,
      normalizedStatus: normalizeOperationStatus(j.status, j.errorMessage),
      durationMs: null,
      error: j.errorMessage,
      createdAt: j.createdAt.toISOString(),
      detail: {
        slug: j.slug,
        wordpressPostUrl: j.wordpressPostUrl,
        imageUrl: j.imageUrl,
      },
    });
  }

  for (const s of newsletterSends) {
    events.push({
      id: `newsletter-${s.id}`,
      sourceType: 'newsletter',
      module: 'Newsletter',
      label: s.campaign.name,
      companyId: s.campaign.companyId,
      companyName: s.campaign.company.name,
      status: s.status,
      normalizedStatus: normalizeOperationStatus(s.status),
      durationMs: null,
      error: s.status === 'failed' ? 'Send failed' : null,
      createdAt: s.sentAt.toISOString(),
      detail: {
        subscriberEmail: s.subscriber.email,
        resendId: s.resendId,
        campaignId: s.campaign.id,
      },
    });
  }

  let filtered = events.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (options.module) {
    const mod = options.module.toLowerCase();
    filtered = filtered.filter((e) => e.module.toLowerCase().includes(mod));
  }

  if (options.status) {
    filtered = filtered.filter((e) => e.normalizedStatus === options.status);
  }

  return filtered.slice(0, options.limit ?? 100);
}
