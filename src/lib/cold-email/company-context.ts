import { prisma } from '@/lib/prisma';
import { getCompanyBrandConfig } from '@/lib/company-brand-config';
import { getOutreachConfig } from './config';
import type { OutreachContext } from './types';

export function formatOutreachBrandBlock(ctx: OutreachContext): string {
  const lines = [
    `Company: ${ctx.companyName}`,
    ctx.productsServices ? `Products/Services: ${ctx.productsServices}` : null,
    ctx.valueProposition ? `Value Proposition: ${ctx.valueProposition}` : null,
    ctx.brandVoice ? `Brand Voice: ${ctx.brandVoice}` : null,
    ctx.positioning ? `Positioning: ${ctx.positioning}` : null,
    ctx.competitors ? `Competitors: ${ctx.competitors}` : null,
    ctx.painPoints ? `Pain Points: ${ctx.painPoints}` : null,
    ctx.icpOutreach ? `Target Audience (Cold Email): ${ctx.icpOutreach}` : null,
    ctx.destinationUrl ? `Website/Destination: ${ctx.destinationUrl}` : null,
    ctx.senderName ? `Sender Name: ${ctx.senderName}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

export async function resolveOutreachContext(companyId: string): Promise<OutreachContext> {
  const [company, config, brandResult] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, slug: true },
    }),
    getOutreachConfig(companyId),
    getCompanyBrandConfig(companyId).catch(() => null),
  ]);

  const brand = brandResult as {
    products_services?: string;
    value_proposition?: string;
    brand_voice?: string;
    positioning?: string;
    competitors?: string;
    pain_points?: string;
    icp_outreach?: string;
    destination_url?: string;
  } | null;

  const companyName = company?.name?.trim() || 'Company';
  const slug = company?.slug || '';
  const defaultWebsite = slug ? `https://${slug}.vercel.app` : '';

  return {
    companyId,
    companyName,
    companySlug: slug,
    productsServices: brand?.products_services || '',
    valueProposition: brand?.value_proposition || '',
    brandVoice: brand?.brand_voice || 'professional and trustworthy',
    positioning: brand?.positioning || '',
    competitors: brand?.competitors || '',
    painPoints: brand?.pain_points || '',
    icpOutreach: brand?.icp_outreach || '',
    destinationUrl: brand?.destination_url || config?.defaultCtaLink || defaultWebsite,
    instantlyCampaignId: config?.instantlyCampaignId || '',
    senderName: config?.senderName || companyName,
    defaultCtaLink: config?.defaultCtaLink || brand?.destination_url || defaultWebsite,
    dailySendLimit: config?.dailySendLimit ?? 60,
  };
}
