import { prisma } from '@/lib/prisma';
import { getRequestCompanyId } from '@/lib/auth';
import {
  computeBrandConfigHash,
  profileFromDb,
  profileToDb,
  type BrandConfigDbRow,
  type BrandProfileData,
} from '@/lib/brand-config';

export const EMPTY_BRAND_PROFILE: BrandProfileData = {
  productsAndServices: '',
  valueProposition: '',
  brandVoice: '',
  positioning: '',
  competitors: '',
  painPoints: '',
  icpMetaAds: '',
  icpNewsletter: '',
  icpOutreach: '',
  icpColdDm: '',
  icpColdCall: '',
  icpColdSms: '',
  icpBlog: '',
  icpSocial: '',
  destinationUrl: '',
};

function rowToApi(config: {
  id: string;
  productsServices: string;
  valueProposition: string;
  brandVoice: string;
  positioning: string;
  competitors: string;
  painPoints: string;
  icpMetaAds: string;
  icpNewsletter: string;
  icpOutreach: string;
  icpColdDm: string;
  icpColdCall: string;
  icpColdSms: string;
  icpBlog: string;
  icpSocial: string;
  destinationUrl: string;
}) {
  return {
    id: config.id,
    products_services: config.productsServices,
    value_proposition: config.valueProposition,
    brand_voice: config.brandVoice,
    positioning: config.positioning,
    competitors: config.competitors,
    pain_points: config.painPoints,
    icp_meta_ads: config.icpMetaAds,
    icp_newsletter: config.icpNewsletter,
    icp_outreach: config.icpOutreach,
    icp_cold_dm: config.icpColdDm,
    icp_cold_call: config.icpColdCall,
    icp_cold_sms: config.icpColdSms,
    icp_blog: config.icpBlog,
    icp_social: config.icpSocial,
    destination_url: config.destinationUrl,
  };
}

function snapshotToApi(snapshot: {
  id: string;
  brandConfigId: string;
  productsServices: string;
  valueProposition: string;
  brandVoice: string;
  positioning: string;
  competitors: string;
  painPoints: string;
  icpMetaAds: string;
  icpNewsletter: string;
  icpOutreach: string;
  icpColdDm: string;
  icpColdCall: string;
  icpColdSms: string;
  icpBlog: string;
  icpSocial: string;
  contentHash: string;
  label: string | null;
  createdAt: Date;
}) {
  return {
    id: snapshot.id,
    brand_config_id: snapshot.brandConfigId,
    products_services: snapshot.productsServices,
    value_proposition: snapshot.valueProposition,
    brand_voice: snapshot.brandVoice,
    positioning: snapshot.positioning,
    competitors: snapshot.competitors,
    pain_points: snapshot.painPoints,
    icp_meta_ads: snapshot.icpMetaAds,
    icp_newsletter: snapshot.icpNewsletter,
    icp_outreach: snapshot.icpOutreach,
    icp_cold_dm: snapshot.icpColdDm,
    icp_cold_call: snapshot.icpColdCall,
    icp_cold_sms: snapshot.icpColdSms,
    icp_blog: snapshot.icpBlog,
    icp_social: snapshot.icpSocial,
    content_hash: snapshot.contentHash,
    label: snapshot.label,
    created_at: snapshot.createdAt.toISOString(),
  };
}

export async function ensureCompanyBrandConfig(companyId: string) {
  return prisma.companyBrandConfig.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
}

export async function getCompanyBrandConfig(companyId: string) {
  const config = await ensureCompanyBrandConfig(companyId);
  return rowToApi(config);
}

export async function getRequestCompanyBrandConfig() {
  const companyId = await getRequestCompanyId();
  if (!companyId) return null;
  return getCompanyBrandConfig(companyId);
}

export async function updateCompanyBrandConfig(companyId: string, body: BrandConfigDbRow) {
  const config = await ensureCompanyBrandConfig(companyId);
  const data: Record<string, string> = {};

  if (body.products_services !== undefined) data.productsServices = body.products_services;
  if (body.value_proposition !== undefined) data.valueProposition = body.value_proposition;
  if (body.brand_voice !== undefined) data.brandVoice = body.brand_voice;
  if (body.positioning !== undefined) data.positioning = body.positioning;
  if (body.competitors !== undefined) data.competitors = body.competitors;
  if (body.pain_points !== undefined) data.painPoints = body.pain_points;
  if (body.icp_meta_ads !== undefined) data.icpMetaAds = body.icp_meta_ads;
  if (body.icp_newsletter !== undefined) data.icpNewsletter = body.icp_newsletter;
  if (body.icp_outreach !== undefined) data.icpOutreach = body.icp_outreach;
  if (body.icp_cold_dm !== undefined) data.icpColdDm = body.icp_cold_dm;
  if (body.icp_cold_call !== undefined) data.icpColdCall = body.icp_cold_call;
  if (body.icp_cold_sms !== undefined) data.icpColdSms = body.icp_cold_sms;
  if (body.icp_blog !== undefined) data.icpBlog = body.icp_blog;
  if (body.icp_social !== undefined) data.icpSocial = body.icp_social;
  if (body.destination_url !== undefined) data.destinationUrl = body.destination_url;

  const updated = await prisma.companyBrandConfig.update({
    where: { id: config.id },
    data,
  });
  return rowToApi(updated);
}

export async function listCompanyBrandSnapshots(companyId: string) {
  const config = await ensureCompanyBrandConfig(companyId);
  const snapshots = await prisma.companyBrandSnapshot.findMany({
    where: { brandConfigId: config.id },
    orderBy: { createdAt: 'desc' },
  });
  return snapshots.map(snapshotToApi);
}

export async function createCompanyBrandSnapshot(
  companyId: string,
  label: string,
  fields: BrandConfigDbRow
) {
  const config = await ensureCompanyBrandConfig(companyId);
  const contentHash = computeBrandConfigHash(fields);

  const latest = await prisma.companyBrandSnapshot.findFirst({
    where: { brandConfigId: config.id },
    orderBy: { createdAt: 'desc' },
    select: { contentHash: true },
  });

  if (latest?.contentHash === contentHash) {
    return { duplicate: true as const };
  }

  const snapshot = await prisma.companyBrandSnapshot.create({
    data: {
      brandConfigId: config.id,
      productsServices: fields.products_services ?? '',
      valueProposition: fields.value_proposition ?? '',
      brandVoice: fields.brand_voice ?? '',
      positioning: fields.positioning ?? '',
      competitors: fields.competitors ?? '',
      painPoints: fields.pain_points ?? '',
      icpMetaAds: fields.icp_meta_ads ?? '',
      icpNewsletter: fields.icp_newsletter ?? '',
      icpOutreach: fields.icp_outreach ?? '',
      icpColdDm: fields.icp_cold_dm ?? '',
      icpColdCall: fields.icp_cold_call ?? '',
      icpColdSms: fields.icp_cold_sms ?? '',
      icpBlog: fields.icp_blog ?? '',
      icpSocial: fields.icp_social ?? '',
      contentHash,
      label,
    },
  });

  return { snapshot: snapshotToApi(snapshot) };
}

export async function updateCompanyBrandSnapshot(
  companyId: string,
  snapshotId: string,
  fields: BrandConfigDbRow
) {
  const config = await ensureCompanyBrandConfig(companyId);
  const contentHash = computeBrandConfigHash(fields);

  const snapshot = await prisma.companyBrandSnapshot.updateMany({
    where: { id: snapshotId, brandConfigId: config.id },
    data: {
      productsServices: fields.products_services ?? '',
      valueProposition: fields.value_proposition ?? '',
      brandVoice: fields.brand_voice ?? '',
      positioning: fields.positioning ?? '',
      competitors: fields.competitors ?? '',
      painPoints: fields.pain_points ?? '',
      icpMetaAds: fields.icp_meta_ads ?? '',
      icpNewsletter: fields.icp_newsletter ?? '',
      icpOutreach: fields.icp_outreach ?? '',
      icpColdDm: fields.icp_cold_dm ?? '',
      icpColdCall: fields.icp_cold_call ?? '',
      icpColdSms: fields.icp_cold_sms ?? '',
      icpBlog: fields.icp_blog ?? '',
      icpSocial: fields.icp_social ?? '',
      contentHash,
    },
  });

  if (snapshot.count === 0) return null;

  const updated = await prisma.companyBrandSnapshot.findUnique({ where: { id: snapshotId } });
  return updated ? snapshotToApi(updated) : null;
}

export async function deleteCompanyBrandSnapshot(companyId: string, snapshotId: string) {
  const config = await ensureCompanyBrandConfig(companyId);
  const result = await prisma.companyBrandSnapshot.deleteMany({
    where: { id: snapshotId, brandConfigId: config.id },
  });
  return result.count > 0;
}

export function brandProfileFromApiRow(row: BrandConfigDbRow | null | undefined): BrandProfileData {
  return profileFromDb(row);
}

export function brandProfileToApiRow(data: BrandProfileData): BrandConfigDbRow {
  return profileToDb(data);
}
