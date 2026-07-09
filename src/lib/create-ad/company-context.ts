import { prisma } from '@/lib/prisma';
import {
  brandFromInput,
  formatBrandContextBlock,
  type AnalysisCompanyContext,
} from '@/lib/competitor-analysis/company-context';
import { brandProfileFromApiRow, getCompanyBrandConfig } from '@/lib/company-brand-config';
import type { CreateAdCompanyContext } from './types';

const DEFAULT_MALE_CHARACTER_IMAGE =
  'https://img.magnific.com/free-photo/portrait-concentrated-young-bearded-man_171337-17191.jpg?semt=ais_hybrid&w=740&q=80';
const DEFAULT_FEMALE_CHARACTER_IMAGE =
  'https://img.magnific.com/free-photo/beauty-fashion-portrait-young-blond-woman-model-with-natural-makeup-perfect-skin-posing-touching-her-face_158538-8756.jpg?semt=ais_hybrid&w=740&q=80';

export function getCharacterImage(character?: string): string {
  const normalized = String(character || 'female').toLowerCase().trim();
  return normalized === 'male' ? DEFAULT_MALE_CHARACTER_IMAGE : DEFAULT_FEMALE_CHARACTER_IMAGE;
}

export function formatCreateAdBrandBlock(ctx: CreateAdCompanyContext): string {
  const analysisCtx: AnalysisCompanyContext = {
    companyName: ctx.companyName,
    topic: ctx.brand.positioning || ctx.companyName,
    keywords: [],
    countries: [],
    brand: ctx.brand,
  };
  const block = formatBrandContextBlock(analysisCtx);
  const lines = [block];
  if (ctx.destinationUrl) {
    lines.push(`Destination URL: ${ctx.destinationUrl}`);
  }
  return lines.join('\n');
}

export async function resolveCreateAdCompanyContext(
  companyId: string,
  brandConfigOverride?: unknown
): Promise<CreateAdCompanyContext> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, slug: true },
  });

  let brand = brandFromInput(brandConfigOverride);
  const dbBrand = await getCompanyBrandConfig(companyId);
  if (!brand) {
    brand = brandProfileFromApiRow(dbBrand);
  }

  let destinationUrl =
    brand.destinationUrl?.trim() ||
    (dbBrand as { destination_url?: string }).destination_url?.trim() ||
    '';

  if (!destinationUrl) {
    const slug = company?.slug?.trim();
    destinationUrl = slug
      ? `https://${slug}.vercel.app/`
      : process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://example.com/';
  }

  return {
    companyId,
    companyName: company?.name?.trim() || 'this company',
    brand,
    destinationUrl,
  };
}
