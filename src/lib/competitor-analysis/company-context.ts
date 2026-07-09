import { prisma } from '@/lib/prisma';
import {
  brandProfileFromApiRow,
  getCompanyBrandConfig,
} from '@/lib/company-brand-config';
import type { BrandConfigDbRow, BrandProfileData } from '@/lib/brand-config';
import type { CompetitorAnalysisInput } from './types';

export type AnalysisCompanyContext = {
  companyName: string;
  topic: string;
  keywords: string[];
  countries: string[];
  brand: BrandProfileData;
};

function hasBrandContent(brand: BrandProfileData): boolean {
  return Boolean(
    brand.productsAndServices?.trim() ||
      brand.valueProposition?.trim() ||
      brand.positioning?.trim() ||
      brand.competitors?.trim() ||
      brand.painPoints?.trim() ||
      brand.icpMetaAds?.trim()
  );
}

export function brandFromInput(raw: unknown): BrandProfileData | null {
  if (!raw || typeof raw !== 'object') return null;
  const brand = brandProfileFromApiRow(raw as BrandConfigDbRow);
  return hasBrandContent(brand) ? brand : null;
}

export async function resolveAnalysisCompanyContext(
  companyId: string,
  input: CompetitorAnalysisInput
): Promise<AnalysisCompanyContext> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  let brand = brandFromInput(input.brand_config);
  if (!brand) {
    const dbBrand = await getCompanyBrandConfig(companyId);
    brand = brandProfileFromApiRow(dbBrand);
  }

  return {
    companyName: company?.name?.trim() || 'this company',
    topic: input.topic?.trim() || input.keywords[0]?.trim() || 'competitor ads',
    keywords: input.keywords || [],
    countries: input.countries || [],
    brand,
  };
}

/** Terms used to filter scraped ads for relevance to this company's market. */
export function buildRelevanceTerms(ctx: AnalysisCompanyContext): string[] {
  const terms = new Set<string>();

  for (const kw of ctx.keywords) {
    const normalized = kw.trim().toLowerCase();
    if (normalized.length > 2) terms.add(normalized);
    for (const word of normalized.split(/[\s,/+-]+/)) {
      if (word.length > 2) terms.add(word);
    }
  }

  const brandTexts = [
    ctx.brand.productsAndServices,
    ctx.brand.valueProposition,
    ctx.brand.positioning,
    ctx.brand.competitors,
    ctx.brand.painPoints,
    ctx.brand.icpMetaAds,
    ctx.topic,
  ];

  for (const text of brandTexts) {
    if (!text?.trim()) continue;
    for (const word of text.toLowerCase().split(/[\s,/+-]+/)) {
      const clean = word.replace(/[^a-z0-9]/g, '');
      if (clean.length > 3) terms.add(clean);
    }
  }

  return [...terms].slice(0, 40);
}

export function formatBrandContextBlock(ctx: AnalysisCompanyContext): string {
  const { brand, companyName, topic, keywords, countries } = ctx;
  const lines: string[] = [`Company: ${companyName}`, `Analysis topic: ${topic}`];

  if (keywords.length) lines.push(`Search keywords: ${keywords.join(', ')}`);
  if (countries.length) lines.push(`Target countries: ${countries.join(', ')}`);

  const fields: Array<[string, string]> = [
    ['Products & services', brand.productsAndServices],
    ['Value proposition', brand.valueProposition],
    ['Brand voice', brand.brandVoice],
    ['Positioning', brand.positioning],
    ['Known competitors', brand.competitors],
    ['Customer pain points', brand.painPoints],
    ['Ideal customer (Meta Ads)', brand.icpMetaAds],
  ];

  for (const [label, value] of fields) {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
  }

  if (lines.length <= 2) {
    lines.push(
      'Note: Limited brand profile on file. Infer the market from search keywords and competitor ad copy. Recommendations should still be specific to the scraped data.'
    );
  }

  return lines.join('\n');
}
