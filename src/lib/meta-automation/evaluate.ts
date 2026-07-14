import { prisma } from '@/lib/prisma';
import { getMetaCredentialsForCompany } from '@/lib/meta-credentials';
import { buildLaunchAdsFromVariants, launchAdsBatch } from '@/lib/meta/launch-batch';
import { deleteMetaAd, pauseMetaAd, renameMetaAd } from '@/lib/meta/ad-status';
import { regenerateFromWinner } from './generate';

type InsightRow = {
  ad_id?: string;
  spend?: string;
  clicks?: string;
  inline_link_click_ctr?: string;
  cpc?: string;
  actions?: Array<{ action_type: string; value: string }>;
};

function parseNum(val: string | undefined) {
  return parseFloat(val || '0') || 0;
}

function getActionCount(actions: InsightRow['actions'], type: string) {
  return parseNum(actions?.find((a) => a.action_type === type)?.value);
}

export function pickWinnerByObjectiveAware(
  rows: Array<{ variantId: string; metaAdId: string; insights: InsightRow }>,
  objective?: string
) {
  const isConversionObjective =
    objective === 'OUTCOME_SALES' ||
    objective === 'OUTCOME_LEADS' ||
    objective === 'OUTCOME_APP_PROMOTION';

  const scored = rows.map((row) => {
    const spend = parseNum(row.insights.spend);
    const clicks = parseNum(row.insights.clicks);
    const leads = getActionCount(row.insights.actions, 'lead');
    const purchases = getActionCount(row.insights.actions, 'purchase');
    const conversions = leads + purchases;

    let score: number;
    if (isConversionObjective && conversions > 0) {
      score = spend / conversions;
    } else if (clicks > 0) {
      score = spend / clicks;
    } else {
      score = spend > 0 ? spend / 0.0001 : Number.MAX_SAFE_INTEGER;
    }

    return { ...row, spend, clicks, conversions, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0] || null;
}

async function fetchAdSetInsights(
  accessToken: string,
  adAccountId: string,
  adSetId: string,
  days: number
) {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const timeRange = JSON.stringify({
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  });

  const url =
    `https://graph.facebook.com/v21.0/act_${adAccountId}/insights` +
    `?level=ad&fields=ad_id,spend,clicks,inline_link_click_ctr,cpc,actions` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'adset.id', operator: 'IN', value: [adSetId] }]))}` +
    `&limit=100&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to fetch insights');
  return (data.data || []) as InsightRow[];
}

export async function evaluateAutomation(automationId: string) {
  const automation = await prisma.adAutomation.findUnique({
    where: { id: automationId },
  });
  if (!automation) throw new Error('Automation not found');
  if (!automation.metaAdSetId) throw new Error('Automation has no Meta ad set');

  const currentVariants = await prisma.adVariant.findMany({
    where: { automationId, generation: automation.generation },
    orderBy: { createdAt: 'asc' },
  });

  const meta = await getMetaCredentialsForCompany(automation.companyId);
  if (!meta) throw new Error('Missing Meta credentials');

  await prisma.adAutomation.update({
    where: { id: automationId },
    data: { status: 'evaluating' },
  });

  const insights = await fetchAdSetInsights(
    meta.accessToken,
    meta.adAccountId,
    automation.metaAdSetId,
    automation.evalLengthDays
  );

  const insightMap = new Map(insights.map((row) => [row.ad_id, row]));
  const activeVariants = currentVariants.filter(
    (v) => v.metaAdId && (v.role === 'base' || v.role === 'challenger' || v.role === 'winner')
  );

  const scoredRows = activeVariants
    .filter((v) => v.metaAdId && insightMap.has(v.metaAdId))
    .map((v) => ({
      variantId: v.id,
      metaAdId: v.metaAdId!,
      insights: insightMap.get(v.metaAdId!)!,
    }));

  if (!scoredRows.length) {
    throw new Error('No performance data available for evaluation');
  }

  const launchSchema = (automation.launchSchema || {}) as Record<string, unknown>;
  const objective = (launchSchema.campaign as Record<string, unknown> | undefined)?.objective as
    | string
    | undefined;

  const winner = pickWinnerByObjectiveAware(scoredRows, objective);
  if (!winner) throw new Error('Could not determine winner');

  const evaluatedGeneration = automation.generation;
  let loserIndex = 0;

  for (const variant of activeVariants) {
    const insight = variant.metaAdId ? insightMap.get(variant.metaAdId) : null;
    const metrics = insight
      ? {
          spend: insight.spend,
          clicks: insight.clicks,
          cpc: insight.cpc,
          ctr: insight.inline_link_click_ctr,
          actions: insight.actions,
        }
      : null;

    if (variant.id === winner.variantId) {
      if (variant.metaAdId) {
        try {
          await deleteMetaAd(meta.accessToken, variant.metaAdId);
        } catch (err) {
          console.warn('[evaluateAutomation] delete winner failed', variant.metaAdId, err);
        }
      }

      await prisma.adVariant.update({
        where: { id: variant.id },
        data: { role: 'winner', metrics: metrics || undefined, metaAdId: null },
      });
      continue;
    }

    loserIndex += 1;
    const loserName = `generation ${evaluatedGeneration} - loser ${loserIndex}`;

    if (variant.metaAdId) {
      try {
        await pauseMetaAd(meta.accessToken, variant.metaAdId);
        await renameMetaAd(meta.accessToken, variant.metaAdId, loserName);
      } catch (err) {
        console.warn('[evaluateAutomation] archive loser meta update failed', variant.metaAdId, err);
      }
    }

    await prisma.adVariant.update({
      where: { id: variant.id },
      data: { role: 'archived', metrics: metrics || undefined },
    });
  }

  const regenerated = await regenerateFromWinner(automationId, winner.variantId);
  const launchVariants = await prisma.adVariant.findMany({
    where: { automationId, generation: regenerated.generation },
    orderBy: { createdAt: 'asc' },
  });

  if (automation.automationEnabled && automation.launchSchema) {

    const ads = buildLaunchAdsFromVariants(
      automation.launchSchema as { campaign?: Record<string, unknown>; ad_set?: Record<string, unknown>; ad?: Record<string, unknown> },
      launchVariants.map((v) => ({
        mediaUrl: v.mediaUrl,
        format: v.format,
        concept: v.concept as Record<string, unknown>,
      }))
    );

    const relaunchSchema = {
      ...(automation.launchSchema as Record<string, unknown>),
      ad_set: {
        ...((automation.launchSchema as Record<string, unknown>)?.ad_set as Record<string, unknown> || {}),
        existing_id: automation.metaAdSetId,
      },
    };

    const launched = await launchAdsBatch(
      meta,
      relaunchSchema as { campaign?: Record<string, unknown>; ad_set?: Record<string, unknown>; ad?: Record<string, unknown> },
      ads,
      automation.metaCampaignId,
      { adStatus: 'ACTIVE' }
    );

    for (let i = 0; i < launchVariants.length; i++) {
      await prisma.adVariant.update({
        where: { id: launchVariants[i].id },
        data: { metaAdId: launched.adIds[i] || null, role: i === 0 ? 'base' : 'challenger' },
      });
    }

    const nextEval = new Date();
    nextEval.setDate(nextEval.getDate() + automation.evalLengthDays);

    await prisma.adAutomation.update({
      where: { id: automationId },
      data: {
        status: 'running',
        metaAdSetId: launched.adSetId,
        nextEvaluationAt: nextEval,
      },
    });
  } else {
    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'pending_review' },
    });
  }

  return { winnerVariantId: winner.variantId, automationId };
}

export async function runDueAutomations() {
  const due = await prisma.adAutomation.findMany({
    where: {
      status: 'running',
      nextEvaluationAt: { lte: new Date() },
      metaAdSetId: { not: null },
    },
  });

  const results = [];
  for (const automation of due) {
    try {
      const result = await evaluateAutomation(automation.id);
      results.push({ automationId: automation.id, ok: true, result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Evaluation failed';
      await prisma.adAutomation.update({
        where: { id: automation.id },
        data: { status: 'error', error: message },
      });
      results.push({ automationId: automation.id, ok: false, error: message });
    }
  }

  return results;
}
