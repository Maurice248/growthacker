import { prisma } from '@/lib/prisma';
import { getCompanyBrandConfig } from '@/lib/company-brand-config';
import type { BlogConfigData, BlogContext } from './types';

function configFromRow(row: {
  titlePrompt: string;
  titleUserPrompt: string;
  articleSystemPrompt: string;
  articleUserPrompt: string;
  imagePromptSystem: string;
  runHour: number;
  runMinute: number;
  runTimezone: string;
  daysInterval: number;
  active: boolean;
  postStatus: string;
  imageSize: string;
  dataForSeoLocationCode: number;
  openAiModel: string;
  lastCategoryIndex: number;
  lastRunAt: Date | null;
}): BlogConfigData {
  return {
    titlePrompt: row.titlePrompt,
    titleUserPrompt: row.titleUserPrompt,
    articleSystemPrompt: row.articleSystemPrompt,
    articleUserPrompt: row.articleUserPrompt,
    imagePromptSystem: row.imagePromptSystem,
    runHour: row.runHour,
    runMinute: row.runMinute,
    runTimezone: row.runTimezone,
    daysInterval: row.daysInterval,
    active: row.active,
    postStatus: row.postStatus,
    imageSize: row.imageSize,
    dataForSeoLocationCode: row.dataForSeoLocationCode,
    openAiModel: row.openAiModel,
    lastCategoryIndex: row.lastCategoryIndex,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
  };
}

export function formatBlogBrandBlock(ctx: BlogContext): string {
  const lines = [
    `Company: ${ctx.companyName}`,
    ctx.productsServices ? `Products/Services: ${ctx.productsServices}` : null,
    ctx.valueProposition ? `Value Proposition: ${ctx.valueProposition}` : null,
    ctx.brandVoice ? `Brand Voice: ${ctx.brandVoice}` : null,
    ctx.positioning ? `Positioning: ${ctx.positioning}` : null,
    ctx.painPoints ? `Pain Points: ${ctx.painPoints}` : null,
    ctx.competitors ? `Competitors: ${ctx.competitors}` : null,
    ctx.destinationUrl ? `Website: ${ctx.destinationUrl}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

export async function ensureBlogConfig(companyId: string) {
  return prisma.blogConfig.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
}

export async function getBlogConfig(companyId: string): Promise<BlogConfigData | null> {
  const row = await prisma.blogConfig.findUnique({ where: { companyId } });
  if (!row) return null;
  return configFromRow(row);
}

export async function upsertBlogConfig(
  companyId: string,
  input: Partial<BlogConfigData>
): Promise<BlogConfigData> {
  const row = await prisma.blogConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      titlePrompt: input.titlePrompt ?? '',
      titleUserPrompt: input.titleUserPrompt ?? '',
      articleSystemPrompt: input.articleSystemPrompt ?? '',
      articleUserPrompt: input.articleUserPrompt ?? '',
      imagePromptSystem: input.imagePromptSystem ?? '',
      runHour: input.runHour ?? 7,
      runMinute: input.runMinute ?? 0,
      runTimezone: input.runTimezone ?? 'UTC',
      daysInterval: input.daysInterval ?? 3,
      active: input.active ?? true,
      postStatus: input.postStatus ?? 'publish',
      imageSize: input.imageSize ?? '16:9',
      dataForSeoLocationCode: input.dataForSeoLocationCode ?? 2124,
      openAiModel: input.openAiModel ?? 'gpt-4o-mini',
      lastCategoryIndex: input.lastCategoryIndex ?? 0,
    },
    update: {
      ...(input.titlePrompt !== undefined ? { titlePrompt: input.titlePrompt } : {}),
      ...(input.titleUserPrompt !== undefined ? { titleUserPrompt: input.titleUserPrompt } : {}),
      ...(input.articleSystemPrompt !== undefined ? { articleSystemPrompt: input.articleSystemPrompt } : {}),
      ...(input.articleUserPrompt !== undefined ? { articleUserPrompt: input.articleUserPrompt } : {}),
      ...(input.imagePromptSystem !== undefined ? { imagePromptSystem: input.imagePromptSystem } : {}),
      ...(input.runHour !== undefined ? { runHour: input.runHour } : {}),
      ...(input.runMinute !== undefined ? { runMinute: input.runMinute } : {}),
      ...(input.runTimezone !== undefined ? { runTimezone: input.runTimezone } : {}),
      ...(input.daysInterval !== undefined ? { daysInterval: input.daysInterval } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.postStatus !== undefined ? { postStatus: input.postStatus } : {}),
      ...(input.imageSize !== undefined ? { imageSize: input.imageSize } : {}),
      ...(input.dataForSeoLocationCode !== undefined
        ? { dataForSeoLocationCode: input.dataForSeoLocationCode }
        : {}),
      ...(input.openAiModel !== undefined ? { openAiModel: input.openAiModel } : {}),
      ...(input.lastCategoryIndex !== undefined ? { lastCategoryIndex: input.lastCategoryIndex } : {}),
      ...(input.lastRunAt !== undefined
        ? { lastRunAt: input.lastRunAt ? new Date(input.lastRunAt) : null }
        : {}),
    },
  });

  return configFromRow(row);
}

export async function resolveBlogContext(companyId: string): Promise<BlogContext> {
  const [company, config, brandResult] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, slug: true } }),
    ensureBlogConfig(companyId),
    getCompanyBrandConfig(companyId).catch(() => null),
  ]);

  return {
    companyName: company?.name ?? 'Company',
    companySlug: company?.slug ?? '',
    destinationUrl: brandResult?.destinationUrl ?? '',
    productsServices: brandResult?.productsServices ?? '',
    valueProposition: brandResult?.valueProposition ?? '',
    brandVoice: brandResult?.brandVoice ?? '',
    positioning: brandResult?.positioning ?? '',
    painPoints: brandResult?.painPoints ?? '',
    competitors: brandResult?.competitors ?? '',
    openAiModel: config.openAiModel,
    postStatus: config.postStatus,
    imageSize: config.imageSize,
    dataForSeoLocationCode: config.dataForSeoLocationCode,
  };
}
