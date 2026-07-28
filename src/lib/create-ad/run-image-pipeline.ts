import { generateImageConcepts, structurizeReport } from '@/lib/create-ad/image/concepts';
import { startImageGeneration } from '@/lib/create-ad/image/generate';
import { finalizeImageAds } from '@/lib/create-ad/image/finalize';
import { kiePollTasksUntilComplete } from '@/lib/create-ad/kie';
import { getCreateAdTokens, requireToken } from '@/lib/create-ad/tokens';
import type { AdItemInput, ReportData } from '@/lib/create-ad/types';

export async function runFullImageAdPipeline(
  companyId: string,
  reportData: ReportData,
  adsConfig: unknown
) {
  const items = ((adsConfig as { items?: AdItemInput[] }).items || []).filter(
    (i) => i.type === 'image'
  );

  if (!items.length) {
    throw new Error('No image items in ads_config');
  }

  const tokens = await getCreateAdTokens(companyId);
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');

  const structurizerOutput = await structurizeReport(companyId, tokens, reportData, adsConfig);
  const concepts = await generateImageConcepts(
    companyId,
    tokens,
    items,
    reportData,
    structurizerOutput
  );

  const tasks = await startImageGeneration(tokens, concepts);
  const taskIds = tasks.map((t) => t.taskId);
  const pollResults = await kiePollTasksUntilComplete(kieKey, taskIds);

  const finalizeItems = concepts.map((concept, i) => ({
    concept,
    task:
      pollResults[i] ||
      pollResults.find((r) => r.prompt === concept.prompt) || {
        taskId: tasks[i]?.taskId || '',
        state: 'fail',
        resultUrl: null,
        failMsg: 'No poll result',
        prompt: concept.prompt,
      },
  }));

  const results = await finalizeImageAds(
    companyId,
    tokens,
    finalizeItems,
    reportData,
    adsConfig
  );

  return { results, concepts };
}
