import { prisma } from '@/lib/prisma';

/** In-flight Generate Ad Variants run for a company (AdAutomation row). */
export async function getActiveVariantGeneration(companyId: string) {
  return prisma.adAutomation.findFirst({
    where: {
      companyId,
      status: 'generating',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      variants: {
        orderBy: [{ generation: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });
}
