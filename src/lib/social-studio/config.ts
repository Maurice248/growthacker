import { prisma } from '@/lib/prisma';
import { getCompanyBrandConfig } from '@/lib/company-brand-config';
import type { SocialPlatform, SocialStudioConfigData, SocialStudioContext } from './types';

const DEFAULT_PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'linkedin', 'tiktok'];

function parsePlatforms(raw: unknown): SocialPlatform[] {
  if (!Array.isArray(raw)) return DEFAULT_PLATFORMS;
  const allowed = new Set<SocialPlatform>(['facebook', 'instagram', 'linkedin', 'tiktok', 'x', 'youtube']);
  const parsed = raw.filter((p): p is SocialPlatform => typeof p === 'string' && allowed.has(p as SocialPlatform));
  return parsed.length ? parsed : DEFAULT_PLATFORMS;
}

function configFromRow(row: {
  brandAbout: string;
  brandMission: string;
  brandServices: string;
  brandAudience: string;
  brandWebsite: string;
  tone: string;
  defaultImageRatio: string;
  uploadPostUser: string;
  facebookPageId: string;
  linkedinOrgUrn: string;
  tiktokHandle: string;
  enabledPlatforms: unknown;
}): SocialStudioConfigData {
  return {
    brandAbout: row.brandAbout,
    brandMission: row.brandMission,
    brandServices: row.brandServices,
    brandAudience: row.brandAudience,
    brandWebsite: row.brandWebsite,
    tone: row.tone,
    defaultImageRatio: row.defaultImageRatio || '1:1',
    uploadPostUser: row.uploadPostUser,
    facebookPageId: row.facebookPageId,
    linkedinOrgUrn: row.linkedinOrgUrn,
    tiktokHandle: row.tiktokHandle,
    enabledPlatforms: parsePlatforms(row.enabledPlatforms),
  };
}

export function formatSocialBrandBlock(ctx: SocialStudioContext): string {
  const lines = [
    `Company: ${ctx.companyName}`,
    ctx.brandWebsite ? `Website: ${ctx.brandWebsite}` : null,
    ctx.brandAbout ? `About: ${ctx.brandAbout}` : null,
    ctx.brandMission ? `Mission: ${ctx.brandMission}` : null,
    ctx.brandServices ? `Services: ${ctx.brandServices}` : null,
    ctx.brandAudience ? `Audience: ${ctx.brandAudience}` : null,
    ctx.tone ? `Tone: ${ctx.tone}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

export async function getSocialStudioConfig(companyId: string): Promise<SocialStudioConfigData | null> {
  const row = await prisma.socialStudioConfig.findUnique({ where: { companyId } });
  if (!row) return null;
  return configFromRow(row);
}

export async function upsertSocialStudioConfig(
  companyId: string,
  input: Partial<SocialStudioConfigData>
): Promise<SocialStudioConfigData> {
  const row = await prisma.socialStudioConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      brandAbout: input.brandAbout ?? '',
      brandMission: input.brandMission ?? '',
      brandServices: input.brandServices ?? '',
      brandAudience: input.brandAudience ?? '',
      brandWebsite: input.brandWebsite ?? '',
      tone: input.tone ?? '',
      defaultImageRatio: input.defaultImageRatio ?? '1:1',
      uploadPostUser: input.uploadPostUser ?? '',
      facebookPageId: input.facebookPageId ?? '',
      linkedinOrgUrn: input.linkedinOrgUrn ?? '',
      tiktokHandle: input.tiktokHandle ?? '',
      enabledPlatforms: input.enabledPlatforms ?? DEFAULT_PLATFORMS,
    },
    update: {
      ...(input.brandAbout !== undefined ? { brandAbout: input.brandAbout } : {}),
      ...(input.brandMission !== undefined ? { brandMission: input.brandMission } : {}),
      ...(input.brandServices !== undefined ? { brandServices: input.brandServices } : {}),
      ...(input.brandAudience !== undefined ? { brandAudience: input.brandAudience } : {}),
      ...(input.brandWebsite !== undefined ? { brandWebsite: input.brandWebsite } : {}),
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(input.defaultImageRatio !== undefined ? { defaultImageRatio: input.defaultImageRatio } : {}),
      ...(input.uploadPostUser !== undefined ? { uploadPostUser: input.uploadPostUser } : {}),
      ...(input.facebookPageId !== undefined ? { facebookPageId: input.facebookPageId } : {}),
      ...(input.linkedinOrgUrn !== undefined ? { linkedinOrgUrn: input.linkedinOrgUrn } : {}),
      ...(input.tiktokHandle !== undefined ? { tiktokHandle: input.tiktokHandle } : {}),
      ...(input.enabledPlatforms !== undefined ? { enabledPlatforms: input.enabledPlatforms } : {}),
    },
  });

  return configFromRow(row);
}

export async function resolveSocialContext(companyId: string): Promise<SocialStudioContext> {
  const [company, config, brandResult] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, slug: true } }),
    getSocialStudioConfig(companyId),
    getCompanyBrandConfig(companyId).catch(() => null),
  ]);
  const brand = brandResult;

  const companyName = company?.name || 'Company';
  const brandRow = brand as {
    products_services?: string;
    value_proposition?: string;
    brand_voice?: string;
    positioning?: string;
    destination_url?: string;
    icp_meta_ads?: string;
  } | null;

  return {
    companyId,
    companyName,
    brandAbout: config?.brandAbout || brandRow?.positioning || brandRow?.value_proposition || '',
    brandMission: config?.brandMission || brandRow?.value_proposition || '',
    brandServices: config?.brandServices || brandRow?.products_services || '',
    brandAudience: config?.brandAudience || brandRow?.icp_meta_ads || '',
    brandWebsite:
      config?.brandWebsite ||
      brandRow?.destination_url ||
      (company?.slug ? `https://${company.slug}.vercel.app` : ''),
    tone: config?.tone || brandRow?.brand_voice || 'professional and trustworthy',
    defaultImageRatio: config?.defaultImageRatio || '1:1',
    uploadPostUser: config?.uploadPostUser || '',
    facebookPageId: config?.facebookPageId || '',
    linkedinOrgUrn: config?.linkedinOrgUrn || '',
    tiktokHandle: config?.tiktokHandle || '',
    enabledPlatforms: config?.enabledPlatforms || DEFAULT_PLATFORMS,
  };
}
