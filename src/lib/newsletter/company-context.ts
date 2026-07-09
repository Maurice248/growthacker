import { prisma } from '@/lib/prisma';
import { getCompanyBrandConfig } from '@/lib/company-brand-config';
import type { NewsletterConfigData, NewsletterContext } from './types';

function configFromRow(row: {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  website: string;
  logoUrl: string;
  addressLine: string;
  phone: string;
  unsubscribeBaseUrl: string;
  sendHour: number;
  sendMinute: number;
  sendTimezone: string;
  dailyLimit: number;
  active: boolean;
}): NewsletterConfigData {
  return {
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    replyTo: row.replyTo,
    website: row.website,
    logoUrl: row.logoUrl,
    addressLine: row.addressLine,
    phone: row.phone,
    unsubscribeBaseUrl: row.unsubscribeBaseUrl,
    sendHour: row.sendHour,
    sendMinute: row.sendMinute,
    sendTimezone: row.sendTimezone,
    dailyLimit: row.dailyLimit,
    active: row.active,
  };
}

export function formatNewsletterBrandBlock(ctx: NewsletterContext): string {
  const lines = [
    `Company: ${ctx.companyName}`,
    ctx.productsServices ? `Products/Services: ${ctx.productsServices}` : null,
    ctx.valueProposition ? `Value Proposition: ${ctx.valueProposition}` : null,
    ctx.brandVoice ? `Brand Voice: ${ctx.brandVoice}` : null,
    ctx.positioning ? `Positioning: ${ctx.positioning}` : null,
    ctx.competitors ? `Competitors: ${ctx.competitors}` : null,
    ctx.painPoints ? `Pain Points: ${ctx.painPoints}` : null,
    ctx.icpNewsletter ? `Target Audience (Newsletter): ${ctx.icpNewsletter}` : null,
    ctx.website ? `Website: ${ctx.website}` : null,
    ctx.addressLine ? `Address: ${ctx.addressLine}` : null,
    ctx.phone ? `Phone: ${ctx.phone}` : null,
    ctx.fromEmail ? `Contact Email: ${ctx.fromEmail}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

export async function getNewsletterConfig(companyId: string): Promise<NewsletterConfigData | null> {
  const row = await prisma.newsletterConfig.findUnique({ where: { companyId } });
  if (!row) return null;
  return configFromRow(row);
}

export async function upsertNewsletterConfig(
  companyId: string,
  input: Partial<NewsletterConfigData>
): Promise<NewsletterConfigData> {
  const row = await prisma.newsletterConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      fromEmail: input.fromEmail ?? '',
      fromName: input.fromName ?? '',
      replyTo: input.replyTo ?? '',
      website: input.website ?? '',
      logoUrl: input.logoUrl ?? '',
      addressLine: input.addressLine ?? '',
      phone: input.phone ?? '',
      unsubscribeBaseUrl: input.unsubscribeBaseUrl ?? '',
      sendHour: input.sendHour ?? 10,
      sendMinute: input.sendMinute ?? 30,
      sendTimezone: input.sendTimezone ?? 'UTC',
      dailyLimit: input.dailyLimit ?? 50,
      active: input.active ?? true,
    },
    update: {
      ...(input.fromEmail !== undefined ? { fromEmail: input.fromEmail } : {}),
      ...(input.fromName !== undefined ? { fromName: input.fromName } : {}),
      ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.unsubscribeBaseUrl !== undefined ? { unsubscribeBaseUrl: input.unsubscribeBaseUrl } : {}),
      ...(input.sendHour !== undefined ? { sendHour: input.sendHour } : {}),
      ...(input.sendMinute !== undefined ? { sendMinute: input.sendMinute } : {}),
      ...(input.sendTimezone !== undefined ? { sendTimezone: input.sendTimezone } : {}),
      ...(input.dailyLimit !== undefined ? { dailyLimit: input.dailyLimit } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });

  return configFromRow(row);
}

export async function resolveNewsletterContext(companyId: string): Promise<NewsletterContext> {
  const [company, config, brandResult] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, slug: true, logoUrl: true },
    }),
    getNewsletterConfig(companyId),
    getCompanyBrandConfig(companyId).catch(() => null),
  ]);

  const brand = brandResult as {
    products_services?: string;
    value_proposition?: string;
    brand_voice?: string;
    positioning?: string;
    competitors?: string;
    pain_points?: string;
    icp_newsletter?: string;
    destination_url?: string;
  } | null;

  const companyName = company?.name || 'Company';
  const slug = company?.slug || '';
  const defaultWebsite = slug ? `https://${slug}.vercel.app` : '';

  return {
    companyId,
    companyName,
    companySlug: slug,
    productsServices: brand?.products_services || '',
    valueProposition: brand?.value_proposition || '',
    brandVoice: brand?.brand_voice || 'professional and warm',
    positioning: brand?.positioning || '',
    competitors: brand?.competitors || '',
    painPoints: brand?.pain_points || '',
    icpNewsletter: brand?.icp_newsletter || '',
    fromEmail: config?.fromEmail || '',
    fromName: config?.fromName || companyName,
    replyTo: config?.replyTo || config?.fromEmail || '',
    website: config?.website || brand?.destination_url || defaultWebsite,
    logoUrl: config?.logoUrl || company?.logoUrl || (defaultWebsite ? `${defaultWebsite}/logo.png` : ''),
    addressLine: config?.addressLine || '',
    phone: config?.phone || '',
    unsubscribeBaseUrl:
      config?.unsubscribeBaseUrl || (defaultWebsite ? `${defaultWebsite}/unsubscribe` : ''),
    sendHour: config?.sendHour ?? 10,
    sendMinute: config?.sendMinute ?? 30,
    sendTimezone: config?.sendTimezone ?? 'UTC',
    dailyLimit: config?.dailyLimit ?? 50,
    active: config?.active ?? true,
  };
}
