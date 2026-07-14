export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getMetaCredentialsForRequest } from '@/lib/meta-credentials';
import { buildLaunchAdsFromVariants, launchAdsBatch } from '@/lib/meta/launch-batch';
import { activateMetaAd, pauseMetaAd } from '@/lib/meta/ad-status';
import { evaluateAutomation } from '@/lib/meta-automation/evaluate';
import { regenerateSingleVariant } from '@/lib/meta-automation/generate';

type RouteContext = { params: Promise<{ id: string }> };

const DELETABLE_STATUSES = new Set(['pending_review', 'generating', 'error']);

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { id } = await context.params;
    const automation = await prisma.adAutomation.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    if (!DELETABLE_STATUSES.has(automation.status)) {
      return NextResponse.json(
        { error: 'Cannot delete a loop that is launched or actively running' },
        { status: 400 }
      );
    }

    await prisma.adAutomation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete automation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { id } = await context.params;
    const automation = await prisma.adAutomation.findFirst({
      where: { id, companyId },
      include: {
        variants: {
          orderBy: [{ generation: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    return NextResponse.json({ automation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load automation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { id } = await context.params;
    const body = await request.json();

    const automation = await prisma.adAutomation.updateMany({
      where: { id, companyId },
      data: {
        ...(body.automationEnabled !== undefined
          ? { automationEnabled: Boolean(body.automationEnabled) }
          : {}),
        ...(body.status ? { status: String(body.status) } : {}),
      },
    });

    if (!automation.count) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    const updated = await prisma.adAutomation.findFirst({
      where: { id, companyId },
      include: { variants: true },
    });

    return NextResponse.json({ automation: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update automation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const meta = await getMetaCredentialsForRequest();
    if (!meta) {
      return NextResponse.json({ error: 'Missing Meta credentials' }, { status: 500 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = body.action as string;

    const automation = await prisma.adAutomation.findFirst({
      where: { id, companyId },
      include: {
        variants: {
          where: { generation: body.generation },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    if (action === 'evaluate') {
      if (!automation.metaAdSetId) {
        return NextResponse.json({ error: 'Automation has no launched ad set yet' }, { status: 400 });
      }
      if (!['running', 'error'].includes(automation.status)) {
        return NextResponse.json(
          { error: `Cannot evaluate while status is "${automation.status}"` },
          { status: 400 }
        );
      }

      void evaluateAutomation(id).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Evaluation failed';
        console.error('[meta/automation/evaluate]', id, err);
        await prisma.adAutomation.update({
          where: { id },
          data: { status: 'error', error: message },
        });
      });

      return NextResponse.json({ success: true, status: 'evaluating' });
    }

    if (action === 'finalize_launch') {
      const generation = Number(body.generation) || automation.generation;
      const adIds = (body.adIds || []) as string[];
      const variants = await prisma.adVariant.findMany({
        where: {
          automationId: id,
          generation,
          role: { in: ['base', 'challenger'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (let i = 0; i < variants.length; i++) {
        await prisma.adVariant.update({
          where: { id: variants[i].id },
          data: { metaAdId: adIds[i] || null },
        });
      }

      const nextEval = new Date();
      nextEval.setDate(nextEval.getDate() + automation.evalLengthDays);

      const updated = await prisma.adAutomation.update({
        where: { id },
        data: {
          metaCampaignId: body.campaignId || automation.metaCampaignId,
          metaAdSetId: body.adSetId || automation.metaAdSetId,
          launchSchema: body.schema || automation.launchSchema,
          automationEnabled:
            body.automationEnabled !== undefined
              ? Boolean(body.automationEnabled)
              : automation.automationEnabled,
          status: 'running',
          nextEvaluationAt: nextEval,
        },
        include: { variants: { where: { generation } } },
      });

      return NextResponse.json({ success: true, automation: updated });
    }

    if (action === 'reject_variant') {
      const variantId = String(body.variantId || '');
      if (!variantId) {
        return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
      }
      if (automation.status !== 'pending_review') {
        return NextResponse.json(
          { error: `Cannot reject variants while status is "${automation.status}"` },
          { status: 400 }
        );
      }
      if (automation.automationEnabled) {
        return NextResponse.json(
          { error: 'Cannot reject variants when auto-launch is enabled' },
          { status: 400 }
        );
      }

      const variant = await prisma.adVariant.findFirst({
        where: {
          id: variantId,
          automationId: id,
          generation: automation.generation,
          role: 'challenger',
        },
      });
      if (!variant) {
        return NextResponse.json({ error: 'Challenger variant not found' }, { status: 404 });
      }

      void regenerateSingleVariant(id, variantId).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Variant regeneration failed';
        console.error('[meta/automation/reject_variant]', id, variantId, err);
        await prisma.adAutomation.update({
          where: { id },
          data: { status: 'error', error: message },
        });
      });

      return NextResponse.json({ success: true, status: 'generating' });
    }

    if (action === 'launch') {
      const generation = Number(body.generation) || automation.generation;
      const variants = await prisma.adVariant.findMany({
        where: {
          automationId: id,
          generation,
          role: { in: ['base', 'challenger'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!variants.length) {
        return NextResponse.json({ error: 'No variants to launch' }, { status: 400 });
      }

      const schema = body.schema || automation.launchSchema;
      if (!schema || typeof schema !== 'object' || !Object.keys(schema as object).length) {
        return NextResponse.json(
          {
            error:
              'Launch settings are missing for this loop. Re-launch from Campaign Setup to save your ad configuration, then try again.',
          },
          { status: 400 }
        );
      }

      const relaunchSchema = {
        ...(schema as Record<string, unknown>),
        ad_set: {
          ...(((schema as Record<string, unknown>).ad_set as Record<string, unknown>) || {}),
          existing_id: automation.metaAdSetId || (schema as { ad_set?: { existing_id?: string } }).ad_set?.existing_id || null,
        },
      };

      const ads = buildLaunchAdsFromVariants(
        relaunchSchema as { campaign?: Record<string, unknown>; ad_set?: Record<string, unknown>; ad?: Record<string, unknown> },
        variants.map((v) => ({
          mediaUrl: v.mediaUrl,
          format: v.format,
          concept: v.concept as Record<string, unknown>,
        }))
      );

      const launched = await launchAdsBatch(
        meta,
        relaunchSchema as { campaign?: Record<string, unknown>; ad_set?: Record<string, unknown>; ad?: Record<string, unknown> },
        ads,
        body.campaignId || automation.metaCampaignId,
        { adStatus: 'ACTIVE' }
      );

      const previousVariants = await prisma.adVariant.findMany({
        where: {
          automationId: id,
          metaAdId: { not: null },
          id: { notIn: variants.map((v) => v.id) },
        },
      });

      for (const previous of previousVariants) {
        if (!previous.metaAdId) continue;
        try {
          await pauseMetaAd(meta.accessToken, previous.metaAdId);
        } catch (err) {
          console.warn('[meta/automation/launch] pause previous ad failed', previous.metaAdId, err);
        }
      }

      for (const adId of launched.adIds) {
        if (!adId) continue;
        try {
          await activateMetaAd(meta.accessToken, adId);
        } catch (err) {
          console.warn('[meta/automation/launch] activate new ad failed', adId, err);
        }
      }

      for (let i = 0; i < variants.length; i++) {
        await prisma.adVariant.update({
          where: { id: variants[i].id },
          data: {
            metaAdId: launched.adIds[i] || null,
            role: i === 0 ? 'base' : 'challenger',
          },
        });
      }

      for (const previous of previousVariants) {
        if (previous.role === 'winner' || previous.role === 'base' || previous.role === 'challenger') {
          await prisma.adVariant.update({
            where: { id: previous.id },
            data: { role: 'archived' },
          });
        }
      }

      const nextEval = new Date();
      nextEval.setDate(nextEval.getDate() + automation.evalLengthDays);

      const updated = await prisma.adAutomation.update({
        where: { id },
        data: {
          metaCampaignId: launched.campaignId,
          metaAdSetId: launched.adSetId,
          launchSchema: schema,
          status: 'running',
          nextEvaluationAt: nextEval,
        },
        include: { variants: { where: { generation } } },
      });

      return NextResponse.json({ success: true, launched, automation: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Automation action failed';
    console.error('[meta/automation/[id]]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
