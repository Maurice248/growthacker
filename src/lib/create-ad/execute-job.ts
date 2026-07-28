import { runFullImageAdPipeline } from '@/lib/create-ad/run-image-pipeline';
import { updateCreateAdJob, type CreateAdJobKind } from '@/lib/create-ad/jobs';
import { getCreateAdTokens } from '@/lib/create-ad/tokens';
import { runVideoGenerationBatch } from '@/lib/create-ad/video/generate';
import { runVideoPromptsPipeline } from '@/lib/create-ad/video/prompts-pipeline';
import type { AdItemInput, ReportData, VideoScene } from '@/lib/create-ad/types';
import { prisma } from '@/lib/prisma';

export async function executeCreateAdJob(jobId: string): Promise<void> {
  const row = await prisma.createAdJob.findUnique({ where: { id: jobId } });
  if (!row) return;

  const companyId = row.companyId;
  const kind = row.kind as CreateAdJobKind;
  const input = row.input as Record<string, unknown>;

  await updateCreateAdJob(jobId, companyId, { status: 'running', error: null });

  try {
    const tokens = await getCreateAdTokens(companyId);
    let result: unknown;

    if (kind === 'prompts') {
      const adsConfig = input.ads_config || {};
      const items = ((adsConfig as { items?: AdItemInput[] }).items || []) as AdItemInput[];
      result = await runVideoPromptsPipeline(companyId, tokens, items);
    } else if (kind === 'video') {
      const reportData = (input.report_data || {}) as ReportData;
      const adsConfig = input.ads_config || {};
      const generatedPrompts = (input.generated_prompts || {}) as Record<string, VideoScene[]>;
      const audioKeys = (input.audioKeys || input.audio_keys || {}) as Record<string, string>;
      const audioUrls = (input.audioUrls || {}) as Record<string, string>;

      const batchItems = Object.entries(generatedPrompts)
        .filter(([, scenes]) => Array.isArray(scenes) && scenes.length > 0)
        .map(([itemId, scenes]) => ({
          itemId,
          scenes,
          audioKey: audioKeys[itemId] || '',
          audioUrl: audioUrls[itemId] || '',
        }));

      if (!batchItems.length) {
        throw new Error('generated_prompts is required');
      }

      result = await runVideoGenerationBatch(
        companyId,
        tokens,
        batchItems,
        reportData,
        adsConfig
      );
    } else if (kind === 'image') {
      const reportData = (input.report_data || {}) as ReportData;
      const adsConfig = input.ads_config || {};
      result = await runFullImageAdPipeline(companyId, reportData, adsConfig);
    } else {
      throw new Error(`Unknown job kind: ${kind}`);
    }

    await updateCreateAdJob(jobId, companyId, { status: 'completed', result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create Ad job failed';
    console.error('[create-ad/execute-job]', jobId, err);
    await updateCreateAdJob(jobId, companyId, { status: 'failed', error: message });
  }
}
