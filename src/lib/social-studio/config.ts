import { prisma } from '@/lib/prisma';
import { getCompanyBrandConfig } from '@/lib/company-brand-config';
import type {
  SocialPlatform,
  SocialStudioBrandPromptContext,
  SocialStudioConfigData,
  SocialStudioContext,
  SocialStudioPostingConfig,
} from './types';

const DEFAULT_PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'linkedin', 'tiktok'];

function parsePlatforms(raw: unknown): SocialPlatform[] {
  if (!Array.isArray(raw)) return DEFAULT_PLATFORMS;
  const allowed = new Set<SocialPlatform>(['facebook', 'instagram', 'linkedin', 'tiktok', 'x', 'youtube']);
  const parsed = raw.filter((p): p is SocialPlatform => typeof p === 'string' && allowed.has(p as SocialPlatform));
  return parsed.length ? parsed : DEFAULT_PLATFORMS;
}

function postingFromRow(row: {
  defaultImageRatio: string;
  uploadPostUser: string;
  facebookPageId: string;
  linkedinOrgUrn: string;
  tiktokHandle: string;
  enabledPlatforms: unknown;
}): SocialStudioPostingConfig {
  return {
    defaultImageRatio: row.defaultImageRatio || '1:1',
    uploadPostUser: row.uploadPostUser,
    facebookPageId: row.facebookPageId,
    linkedinOrgUrn: row.linkedinOrgUrn,
    tiktokHandle: row.tiktokHandle,
    enabledPlatforms: parsePlatforms(row.enabledPlatforms),
  };
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
    ...postingFromRow(row),
    brandAbout: row.brandAbout,
    brandMission: row.brandMission,
    brandServices: row.brandServices,
    brandAudience: row.brandAudience,
    brandWebsite: row.brandWebsite,
    tone: row.tone,
  };
}

function brandPromptContextFromBrandRow(
  brandRow: {
    products_services?: string;
    value_proposition?: string;
    brand_voice?: string;
    positioning?: string;
    destination_url?: string;
    icp_meta_ads?: string;
    icp_social?: string;
  } | null,
  companySlug?: string | null
): SocialStudioBrandPromptContext {
  return {
    brandAbout: brandRow?.positioning || brandRow?.value_proposition || '',
    brandMission: brandRow?.value_proposition || '',
    brandServices: brandRow?.products_services || '',
    brandAudience: brandRow?.icp_social || brandRow?.icp_meta_ads || '',
    brandWebsite: brandRow?.destination_url || (companySlug ? `https://${companySlug}.vercel.app` : ''),
    tone: brandRow?.brand_voice || 'professional and trustworthy',
  };
}

export function postingFromConfig(config: SocialStudioConfigData | null): SocialStudioPostingConfig | null {
  if (!config) return null;
  return postingFromRow(config);
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

export async function getSocialStudioPostingConfig(companyId: string): Promise<SocialStudioPostingConfig | null> {
  const config = await getSocialStudioConfig(companyId);
  return postingFromConfig(config);
}

export async function upsertSocialStudioConfig(
  companyId: string,
  input: Partial<SocialStudioPostingConfig>
): Promise<SocialStudioPostingConfig> {
  const row = await prisma.socialStudioConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      brandAbout: '',
      brandMission: '',
      brandServices: '',
      brandAudience: '',
      brandWebsite: '',
      tone: '',
      defaultImageRatio: input.defaultImageRatio ?? '1:1',
      uploadPostUser: input.uploadPostUser ?? '',
      facebookPageId: input.facebookPageId ?? '',
      linkedinOrgUrn: input.linkedinOrgUrn ?? '',
      tiktokHandle: input.tiktokHandle ?? '',
      enabledPlatforms: input.enabledPlatforms ?? DEFAULT_PLATFORMS,
    },
    update: {
      ...(input.defaultImageRatio !== undefined ? { defaultImageRatio: input.defaultImageRatio } : {}),
      ...(input.uploadPostUser !== undefined ? { uploadPostUser: input.uploadPostUser } : {}),
      ...(input.facebookPageId !== undefined ? { facebookPageId: input.facebookPageId } : {}),
      ...(input.linkedinOrgUrn !== undefined ? { linkedinOrgUrn: input.linkedinOrgUrn } : {}),
      ...(input.tiktokHandle !== undefined ? { tiktokHandle: input.tiktokHandle } : {}),
      ...(input.enabledPlatforms !== undefined ? { enabledPlatforms: input.enabledPlatforms } : {}),
    },
  });

  return postingFromRow(row);
}

export async function resolveSocialContext(companyId: string): Promise<SocialStudioContext> {
  const [company, postingConfig, brandResult] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, slug: true } }),
    getSocialStudioPostingConfig(companyId),
    getCompanyBrandConfig(companyId).catch(() => null),
  ]);

  const brandRow = brandResult as {
    products_services?: string;
    value_proposition?: string;
    brand_voice?: string;
    positioning?: string;
    destination_url?: string;
    icp_meta_ads?: string;
    icp_social?: string;
  } | null;

  const companyName = company?.name || 'Company';
  const brandPrompt = brandPromptContextFromBrandRow(brandRow, company?.slug);

  return {
    companyId,
    companyName,
    ...brandPrompt,
    defaultImageRatio: postingConfig?.defaultImageRatio || '1:1',
    uploadPostUser: postingConfig?.uploadPostUser || '',
    facebookPageId: postingConfig?.facebookPageId || '',
    linkedinOrgUrn: postingConfig?.linkedinOrgUrn || '',
    tiktokHandle: postingConfig?.tiktokHandle || '',
    enabledPlatforms: postingConfig?.enabledPlatforms || DEFAULT_PLATFORMS,
  };
}
