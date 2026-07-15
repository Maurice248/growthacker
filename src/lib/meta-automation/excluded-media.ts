import { prisma } from '@/lib/prisma';
import { normalizeAdMediaUrl } from '@/lib/legacy-brand';

/** Extract storage object path (filename) from a Supabase public URL. */
export function extractStorageFilename(url: string | null | undefined): string {
  if (!url) return '';
  const withoutQuery = url.split('?')[0];
  if (withoutQuery.includes('/object/')) {
    const pathPart = withoutQuery.split('/object/')[1]?.replace(/^(public\/|authenticated\/)/, '') || '';
    const segments = pathPart.split('/');
    return segments.slice(1).join('/');
  }
  try {
    return new URL(withoutQuery).pathname.split('/').pop() || '';
  } catch {
    return withoutQuery.split('/').pop() || '';
  }
}

export type AutomationExcludedMedia = {
  urls: Set<string>;
  filenames: Set<string>;
};

/**
 * Media URLs/filenames for variant + automated-campaign challengers.
 * These must not appear in Create Ad → Ad Previews (only Prisma AdVariant).
 */
export async function getAutomationExcludedMedia(companyId: string): Promise<AutomationExcludedMedia> {
  const variants = await prisma.adVariant.findMany({
    where: {
      role: 'challenger',
      automation: { companyId },
    },
    select: { mediaUrl: true },
  });

  const urls = new Set<string>();
  const filenames = new Set<string>();

  for (const variant of variants) {
    const normalized = normalizeAdMediaUrl(variant.mediaUrl);
    if (normalized) urls.add(normalized);
    const filename = extractStorageFilename(variant.mediaUrl);
    if (filename) filenames.add(filename);
  }

  return { urls, filenames };
}

export function isAutomationGeneratedMedia(
  text: string | null | undefined,
  excluded: AutomationExcludedMedia
): boolean {
  if (!text) return false;
  if (excluded.urls.has(normalizeAdMediaUrl(text))) return true;
  const filename = extractStorageFilename(text);
  return Boolean(filename && excluded.filenames.has(filename));
}
