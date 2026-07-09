import { kieCreateImageTasks } from '../kie';
import { requireToken } from '../tokens';
import type { CreateAdTokens, ImageAdConcept } from '../types';

export async function startImageGeneration(
  tokens: CreateAdTokens,
  concepts: ImageAdConcept[]
): Promise<Array<{ taskId: string; prompt: string; id: string | number }>> {
  const kieKey = requireToken(tokens, 'kie', 'KIE API token');

  const prompts = concepts.map((c) => ({
    prompt: c.prompt.replace(/^\*|\*$/g, '').trim(),
    image_size: '4:5' as const,
  }));

  const tasks = await kieCreateImageTasks(kieKey, prompts);
  return tasks.map((t, i) => ({
    ...t,
    id: concepts[i]?.id ?? i,
  }));
}
