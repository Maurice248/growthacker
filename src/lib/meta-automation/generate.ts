import { prisma } from '@/lib/prisma';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import { kieAllComplete, kiePollTasks } from '@/lib/create-ad/kie';
import { startImageGeneration } from '@/lib/create-ad/image/generate';
import { finalizeImageAds } from '@/lib/create-ad/image/finalize';
import { runVideoPromptsForItem } from '@/lib/create-ad/video/prompts-pipeline';
import {
  createSceneImageTasks,
  matchImageResultsToScenes,
  pollSceneImages,
} from '@/lib/create-ad/video/images';
import {
  attachVideoUrlsToScenes,
  createSceneVideoTasks,
  pollSceneVideos,
} from '@/lib/create-ad/video/clips';
import { stitchAndUploadVideo } from '@/lib/create-ad/video/stitch';
import type { AdItemInput, ImageAdConcept } from '@/lib/create-ad/types';
import { fetchBaseAdConcept } from './base-ad';
import { generateVariantConcept } from './prompts';
import type { BaseAdConcept } from './types';

/** Used by Generate Ad Variants + automated campaign regeneration — not Create Ad previews. */
const VARIANT_UPLOAD_OPTIONS = { skipTableInsert: true } as const;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGenerationStep<T>(step: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${step}: ${message}`);
  }
}

async function pollKieTasks(
  tokens: Awaited<ReturnType<typeof getCreateAdTokens>>,
  taskIds: string[],
  opts: { maxAttempts?: number; pollTimeoutMs?: number } = {}
) {
  const kieKey = tokens.kie;
  if (!kieKey) throw new Error('KIE API token not configured');

  const maxAttempts = opts.maxAttempts ?? 120;
  const pollTimeoutMs = opts.pollTimeoutMs ?? 120_000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const results = await kiePollTasks(kieKey, taskIds, { timeoutMs: pollTimeoutMs });
    if (kieAllComplete(results)) return results;
    await sleep(5000);
  }
  throw new Error('Image/video generation timed out after waiting for kie.ai tasks');
}

async function generateImageVariant(
  companyId: string,
  tokens: Awaited<ReturnType<typeof getCreateAdTokens>>,
  baseConcept: BaseAdConcept,
  variantIndex: number
) {
  const variantConcept = await generateVariantConcept(companyId, tokens, baseConcept, variantIndex);
  const concept: ImageAdConcept = {
    id: `variant-${variantIndex + 1}`,
    title: variantConcept.title || `Variant ${variantIndex + 1}`,
    prompt: variantConcept.prompt || `*${variantConcept.idea}*`,
    headline: variantConcept.headline || variantConcept.idea.slice(0, 40),
    cta: variantConcept.cta || 'Learn More',
  };

  const tasks = await startImageGeneration(tokens, [concept]);
  const pollResults = await pollKieTasks(
    tokens,
    tasks.map((t) => t.taskId)
  );

  const finalized = await finalizeImageAds(
    companyId,
    tokens,
    [{ concept, task: pollResults[0] }],
    { variant_of: baseConcept.mediaUrl },
    { totalAds: 1, items: [concept] },
    VARIANT_UPLOAD_OPTIONS
  );

  const result = finalized[0];
  if (!result?.success) {
    throw new Error(result?.error || 'Image variant generation failed');
  }

  return {
    mediaUrl: result.publicUrl as string,
    format: 'Image' as const,
    concept: {
      ...variantConcept,
      metadata: result.metadata,
    },
  };
}

async function generateVideoVariant(
  companyId: string,
  tokens: Awaited<ReturnType<typeof getCreateAdTokens>>,
  baseConcept: BaseAdConcept,
  variantIndex: number
) {
  const variantConcept = await withGenerationStep('Variant concept', () =>
    generateVariantConcept(companyId, tokens, baseConcept, variantIndex)
  );
  const item: AdItemInput = {
    id: variantIndex + 10,
    type: 'video',
    duration: baseConcept.duration || '25s',
    audioStyle: baseConcept.audioStyle,
    videoStyle: baseConcept.videoStyle,
    idea: variantConcept.idea,
    character: baseConcept.character,
    voiceId: baseConcept.voiceId,
    language: baseConcept.language,
  };

  const prompts = await withGenerationStep('Video script and scenes', () =>
    runVideoPromptsForItem(companyId, tokens, item, variantIndex)
  );
  const imageTasks = await withGenerationStep('Scene image tasks', () =>
    createSceneImageTasks(tokens, prompts.scenes)
  );
  const imagePoll = await withGenerationStep('Scene images', () =>
    pollKieTasks(
      tokens,
      imageTasks.map((t) => t.taskId),
      { maxAttempts: 120, pollTimeoutMs: 120_000 }
    )
  );
  const scenesWithImages = matchImageResultsToScenes(
    prompts.scenes,
    imagePoll,
    imageTasks.map((t) => t.prompt)
  );

  const videoTasks = await withGenerationStep('Scene video tasks', () =>
    createSceneVideoTasks(tokens, scenesWithImages)
  );
  const videoPoll = await withGenerationStep('Scene videos', () =>
    pollKieTasks(
      tokens,
      videoTasks.map((t) => t.taskId),
      { maxAttempts: 180, pollTimeoutMs: 120_000 }
    )
  );
  const scenesWithVideos = attachVideoUrlsToScenes(scenesWithImages, videoTasks, videoPoll);

  const stitched = await withGenerationStep('Video stitch and upload', () =>
    stitchAndUploadVideo(
      companyId,
      tokens,
      scenesWithVideos,
      { variant_of: baseConcept.mediaUrl },
      { totalAds: 1, items: [item] },
      {
        audioUrl: prompts.audioUrl,
        audioKey: prompts.audioKey,
        fullScript: variantConcept.idea,
        itemId: item.id,
        ...VARIANT_UPLOAD_OPTIONS,
      }
    )
  );

  return {
    mediaUrl: stitched.publicUrl,
    format: 'Video' as const,
    concept: {
      ...variantConcept,
      metadata: stitched.metadata,
      story: variantConcept.idea,
      scenes: scenesWithVideos,
    },
  };
}

export async function runVariantGeneration(automationId: string) {
  const automation = await prisma.adAutomation.findUnique({
    where: { id: automationId },
    include: { variants: true },
  });
  if (!automation) throw new Error('Automation not found');

  try {
    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'generating', error: null },
    });

    const tokens = await getCreateAdTokens(automation.companyId);
    const baseConcept = automation.baseConcept as unknown as BaseAdConcept;
    const challengersToGenerate = Math.max(0, automation.numVariants - 1);

    for (let i = 0; i < challengersToGenerate; i++) {
      const generated =
        baseConcept.format === 'Image'
          ? await generateImageVariant(automation.companyId, tokens, baseConcept, i)
          : await generateVideoVariant(automation.companyId, tokens, baseConcept, i);

      await prisma.adVariant.create({
        data: {
          automationId,
          generation: automation.generation,
          mediaUrl: generated.mediaUrl,
          format: generated.format,
          concept: generated.concept,
          role: 'challenger',
        },
      });
    }

    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'pending_review' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Variant generation failed';
    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'error', error: message },
    });
    throw err;
  }
}

/** Create DB row only — heavy work runs in bootstrapAndRunVariantGeneration (after POST). */
export async function createVariantGenerationJob(input: {
  companyId: string;
  numVariants: number;
  evalLengthDays: number;
  dailyBudgetCents: number;
  automationEnabled?: boolean;
}) {
  return prisma.adAutomation.create({
    data: {
      companyId: input.companyId,
      baseAdMediaUrl: 'pending',
      baseConcept: {},
      numVariants: input.numVariants,
      evalLengthDays: input.evalLengthDays,
      dailyBudgetCents: input.dailyBudgetCents,
      automationEnabled: input.automationEnabled ?? false,
      status: 'generating',
      generation: 1,
    },
  });
}

/** Full background pipeline: resolve base ad, seed base variant, generate challengers. */
export async function bootstrapAndRunVariantGeneration(
  automationId: string,
  input: {
    baseAdId?: string | number;
    baseAdText?: string;
  }
) {
  const automation = await prisma.adAutomation.findUnique({ where: { id: automationId } });
  if (!automation) throw new Error('Automation not found');

  try {
    const baseConcept = await fetchBaseAdConcept(automation.companyId, {
      baseAdId: input.baseAdId,
      baseAdText: input.baseAdText,
    });

    await prisma.adAutomation.update({
      where: { id: automationId },
      data: {
        baseAdMediaUrl: baseConcept.mediaUrl,
        baseConcept: baseConcept as object,
        status: 'generating',
        error: null,
      },
    });

    const existingBase = await prisma.adVariant.findFirst({
      where: { automationId, generation: automation.generation, role: 'base' },
    });
    if (!existingBase) {
      await prisma.adVariant.create({
        data: {
          automationId,
          generation: automation.generation,
          mediaUrl: baseConcept.mediaUrl,
          format: baseConcept.format,
          concept: baseConcept as object,
          role: 'base',
        },
      });
    }

    await runVariantGeneration(automationId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Variant generation failed';
    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'error', error: message },
    });
    throw err;
  }
}

export async function startVariantGeneration(input: {
  companyId: string;
  baseAdId?: string | number;
  baseAdText?: string;
  numVariants: number;
  evalLengthDays: number;
  dailyBudgetCents: number;
  automationEnabled?: boolean;
}) {
  const baseConcept = await fetchBaseAdConcept(input.companyId, {
    baseAdId: input.baseAdId,
    baseAdText: input.baseAdText,
  });

  const automation = await prisma.adAutomation.create({
    data: {
      companyId: input.companyId,
      baseAdMediaUrl: baseConcept.mediaUrl,
      baseConcept: baseConcept as object,
      numVariants: input.numVariants,
      evalLengthDays: input.evalLengthDays,
      dailyBudgetCents: input.dailyBudgetCents,
      automationEnabled: input.automationEnabled ?? false,
      status: 'generating',
      generation: 1,
      variants: {
        create: {
          generation: 1,
          mediaUrl: baseConcept.mediaUrl,
          format: baseConcept.format,
          concept: baseConcept as object,
          role: 'base',
        },
      },
    },
    include: { variants: true },
  });

  return automation;
}

export async function regenerateFromWinner(automationId: string, winnerVariantId: string) {
  const automation = await prisma.adAutomation.findUnique({
    where: { id: automationId },
    include: { variants: true },
  });
  if (!automation) throw new Error('Automation not found');

  const winner = automation.variants.find((v) => v.id === winnerVariantId);
  if (!winner) throw new Error('Winner variant not found');

  const nextGeneration = automation.generation + 1;
  const baseConcept: BaseAdConcept = {
    mediaUrl: winner.mediaUrl,
    format: winner.format === 'Image' ? 'Image' : 'Video',
    story: (winner.concept as Record<string, unknown>)?.story as string | undefined,
    metadata: (winner.concept as Record<string, unknown>) || {},
    idea: String((winner.concept as Record<string, unknown>)?.idea || ''),
  };

  await prisma.adAutomation.update({
    where: { id: automationId },
    data: {
      generation: nextGeneration,
      baseAdMediaUrl: winner.mediaUrl,
      baseConcept: baseConcept as object,
      status: 'generating',
      error: null,
    },
  });

  await prisma.adVariant.create({
    data: {
      automationId,
      generation: nextGeneration,
      mediaUrl: winner.mediaUrl,
      format: winner.format,
      concept: winner.concept as object,
      role: 'base',
    },
  });

  const tempAutomation = { ...automation, generation: nextGeneration, baseConcept };
  const tokens = await getCreateAdTokens(automation.companyId);
  const challengersToGenerate = Math.max(0, automation.numVariants - 1);

  for (let i = 0; i < challengersToGenerate; i++) {
    const generated =
      baseConcept.format === 'Image'
        ? await generateImageVariant(automation.companyId, tokens, baseConcept, i)
        : await generateVideoVariant(automation.companyId, tokens, baseConcept, i);

    await prisma.adVariant.create({
      data: {
        automationId,
        generation: nextGeneration,
        mediaUrl: generated.mediaUrl,
        format: generated.format,
        concept: generated.concept,
        role: 'challenger',
      },
    });
  }

  return prisma.adAutomation.update({
    where: { id: automationId },
    data: { status: 'pending_review' },
    include: { variants: { where: { generation: nextGeneration } } },
  });
}

export async function regenerateSingleVariant(automationId: string, rejectedVariantId: string) {
  const automation = await prisma.adAutomation.findUnique({
    where: { id: automationId },
    include: { variants: true },
  });
  if (!automation) throw new Error('Automation not found');

  const rejected = automation.variants.find(
    (v) =>
      v.id === rejectedVariantId &&
      v.generation === automation.generation &&
      v.role === 'challenger'
  );
  if (!rejected) throw new Error('Challenger variant not found or cannot be rejected');

  try {
    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'generating', error: null },
    });

    await prisma.adVariant.delete({ where: { id: rejectedVariantId } });

    const baseConcept = automation.baseConcept as unknown as BaseAdConcept;
    const remainingChallengers = automation.variants.filter(
      (v) =>
        v.id !== rejectedVariantId &&
        v.generation === automation.generation &&
        v.role === 'challenger'
    ).length;
    const variantIndex = remainingChallengers;

    const tokens = await getCreateAdTokens(automation.companyId);
    const generated =
      baseConcept.format === 'Image'
        ? await generateImageVariant(automation.companyId, tokens, baseConcept, variantIndex)
        : await generateVideoVariant(automation.companyId, tokens, baseConcept, variantIndex);

    await prisma.adVariant.create({
      data: {
        automationId,
        generation: automation.generation,
        mediaUrl: generated.mediaUrl,
        format: generated.format,
        concept: generated.concept,
        role: 'challenger',
      },
    });

    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'pending_review' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Variant regeneration failed';
    await prisma.adAutomation.update({
      where: { id: automationId },
      data: { status: 'error', error: message },
    });
    throw err;
  }
}
