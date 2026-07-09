import { PrismaClient } from '@prisma/client';
import { createClient, type User } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { encryptSecret } from '../src/lib/integration-crypto';
import { computeBrandConfigHash } from '../src/lib/brand-config';

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@tenantreport.ai').toLowerCase();
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'pass@123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Tenant Report Admin';
const APP_ADMIN_EMAIL = (process.env.APP_ADMIN_EMAIL || 'platform-admin@tenantreport.ai').toLowerCase();
const APP_ADMIN_PASSWORD = process.env.APP_ADMIN_PASSWORD || 'Admin@123!';
const APP_ADMIN_NAME = process.env.APP_ADMIN_NAME || 'Platform Admin';
const PLATFORM_COMPANY_NAME = process.env.PLATFORM_COMPANY_NAME || 'Tenant Report';
const PLATFORM_COMPANY_SLUG = process.env.PLATFORM_COMPANY_SLUG || 'tenant-report';
const PLATFORM_COMPANY_LOGO = '/tenant-report-logo.png';

async function ensureIntegrationsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS company_integrations (
      id TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "metaAccessTokenEnc" TEXT,
      "metaAdAccountId" TEXT,
      "metaPageId" TEXT,
      "elevenLabsApiKeyEnc" TEXT,
      "wordpressSiteUrl" TEXT,
      "wordpressUsername" TEXT,
      "wordpressAppPasswordEnc" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT company_integrations_pkey PRIMARY KEY (id),
      CONSTRAINT company_integrations_companyId_key UNIQUE ("companyId"),
      CONSTRAINT company_integrations_companyId_fkey FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

async function ensurePlatformCompany() {
  const company = await prisma.company.upsert({
    where: { slug: PLATFORM_COMPANY_SLUG },
    update: { name: PLATFORM_COMPANY_NAME, logoUrl: PLATFORM_COMPANY_LOGO },
    create: {
      name: PLATFORM_COMPANY_NAME,
      slug: PLATFORM_COMPANY_SLUG,
      logoUrl: PLATFORM_COMPANY_LOGO,
    },
  });

  console.log('[Prisma] Platform company ready:', company.name, `(id: ${company.id})`);
  return company;
}

async function seedCompanyIntegrationsFromEnv(companyId: string) {
  const existing = await prisma.companyIntegration.findUnique({ where: { companyId } });
  if (existing) {
    console.log('[Prisma] Company integrations already exist — skipping env seed');
    return;
  }

  const metaAccessToken = process.env.META_ACCESS_TOKEN?.trim();
  const metaAdAccountId = process.env.META_AD_ACCOUNT_ID?.trim();
  const metaPageId = process.env.META_PAGE_ID?.trim();
  const elevenLabsApiKey =
    process.env.ELEVENLABS_API_KEY?.trim() || process.env.ELEVEN_LABS_API_KEY?.trim();
  const wordpressSiteUrl = process.env.WORDPRESS_SITE_URL?.trim();
  const wordpressUsername = process.env.WORDPRESS_USERNAME?.trim();
  const wordpressAppPassword = process.env.WORDPRESS_APP_PASSWORD?.replace(/\s/g, '');

  const hasAny =
    metaAccessToken ||
    metaAdAccountId ||
    metaPageId ||
    elevenLabsApiKey ||
    wordpressSiteUrl;

  if (!hasAny) {
    console.log('[Prisma] No integration env vars found — skipping integration seed');
    return;
  }

  await prisma.companyIntegration.create({
    data: {
      companyId,
      metaAccessTokenEnc: metaAccessToken ? encryptSecret(metaAccessToken) : null,
      metaAdAccountId: metaAdAccountId || null,
      metaPageId: metaPageId || null,
      elevenLabsApiKeyEnc: elevenLabsApiKey ? encryptSecret(elevenLabsApiKey) : null,
      wordpressSiteUrl: wordpressSiteUrl?.replace(/\/$/, '') || null,
      wordpressUsername: wordpressUsername || null,
      wordpressAppPasswordEnc: wordpressAppPassword ? encryptSecret(wordpressAppPassword) : null,
    },
  });

  console.log('[Prisma] Seeded company integrations from environment variables');
}

async function seedPrismaAdmin(companyId: string) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: passwordHash,
      role: 'COMPANY_ADMIN',
      name: ADMIN_NAME,
      companyId,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: passwordHash,
      role: 'COMPANY_ADMIN',
      companyId,
    },
  });

  console.log('[Prisma] Admin user ready in Supabase PostgreSQL (users table):', admin.email, `(id: ${admin.id})`);
  return admin;
}

async function seedSupabaseAuthAdmin() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[Supabase Auth] Skipped — missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError || !listData) {
    throw new Error(`[Supabase Auth] listUsers failed: ${listError?.message ?? 'no data'}`);
  }

  const existing = (listData.users as User[]).find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'ADMIN', name: ADMIN_NAME },
    });
    if (error) throw new Error(`[Supabase Auth] updateUser failed: ${error.message}`);
    console.log('[Supabase Auth] Admin user updated:', ADMIN_EMAIL, `(id: ${existing.id})`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'ADMIN', name: ADMIN_NAME },
  });
  if (error) throw new Error(`[Supabase Auth] createUser failed: ${error.message}`);
  console.log('[Supabase Auth] Admin user created:', ADMIN_EMAIL, `(id: ${data.user?.id})`);
}

async function seedTenantReportBrandConfig(companyId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    await prisma.companyBrandConfig.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const LEGACY_ID = 'd33fb700-9a07-4478-9ff1-6f636f2f3625';
  const { data: legacy } = await supabase
    .from('brand_configs')
    .select('*')
    .eq('id', LEGACY_ID)
    .maybeSingle();

  const brandConfig = await prisma.companyBrandConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      productsServices: legacy?.products_services ?? '',
      valueProposition: legacy?.value_proposition ?? '',
      brandVoice: legacy?.brand_voice ?? '',
      positioning: legacy?.positioning ?? '',
      competitors: legacy?.competitors ?? '',
      painPoints: legacy?.pain_points ?? '',
      icpMetaAds: legacy?.icp_meta_ads ?? '',
      icpNewsletter: legacy?.icp_newsletter ?? '',
      icpOutreach: legacy?.icp_outreach ?? '',
    },
    update: {
      productsServices: legacy?.products_services ?? '',
      valueProposition: legacy?.value_proposition ?? '',
      brandVoice: legacy?.brand_voice ?? '',
      positioning: legacy?.positioning ?? '',
      competitors: legacy?.competitors ?? '',
      painPoints: legacy?.pain_points ?? '',
      icpMetaAds: legacy?.icp_meta_ads ?? '',
      icpNewsletter: legacy?.icp_newsletter ?? '',
      icpOutreach: legacy?.icp_outreach ?? '',
    },
  });

  const { data: snapshots } = await supabase
    .from('brand_config_snapshots')
    .select('*')
    .eq('brand_config_id', LEGACY_ID);

  for (const snap of snapshots ?? []) {
    const fields = {
      products_services: snap.products_services ?? '',
      value_proposition: snap.value_proposition ?? '',
      brand_voice: snap.brand_voice ?? '',
      positioning: snap.positioning ?? '',
      competitors: snap.competitors ?? '',
      pain_points: snap.pain_points ?? '',
      icp_meta_ads: snap.icp_meta_ads ?? '',
      icp_newsletter: snap.icp_newsletter ?? '',
      icp_outreach: snap.icp_outreach ?? '',
    };
    const contentHash = snap.content_hash || computeBrandConfigHash(fields);
    const exists = await prisma.companyBrandSnapshot.findFirst({
      where: { brandConfigId: brandConfig.id, contentHash },
    });
    if (exists) continue;

    await prisma.companyBrandSnapshot.create({
      data: {
        brandConfigId: brandConfig.id,
        productsServices: fields.products_services,
        valueProposition: fields.value_proposition,
        brandVoice: fields.brand_voice,
        positioning: fields.positioning,
        competitors: fields.competitors,
        painPoints: fields.pain_points,
        icpMetaAds: fields.icp_meta_ads,
        icpNewsletter: fields.icp_newsletter,
        icpOutreach: fields.icp_outreach,
        contentHash,
        label: snap.label,
        createdAt: snap.created_at ? new Date(snap.created_at) : undefined,
      },
    });
  }

  console.log('[Prisma] Tenant Report brand config ready');
}

/** Social Overview settings — sourced from Tenant Report Creator Studio defaults */
async function seedTenantReportSocialStudioConfig(companyId: string) {
  await prisma.socialStudioConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      brandAbout:
        'Tenant Report is an online tenant screening platform that helps landlords reduce rental risk, screen tenant applicants with background checks and credit reports, and ensure reliable rental income through AI-powered tenant evaluation and rental protection services.',
      brandMission:
        'Reduce risk and ensure reliable income for landlords through smarter tenant screening and property protection.',
      brandServices:
        'Tenant screening reports, Smart Tenant Subscription (AI-powered tenant insights), Rent Promise protection, and property management tools.',
      brandAudience:
        'Landlords and property owners who want confident tenant decisions and peace of mind. Canadian landlords and property managers screening rental applicants.',
      brandWebsite: 'https://tenant-report-app.vercel.app/',
      tone: 'Professional, trustworthy, and landlord-focused. Reassuring and risk-focused without fear-based language.',
      defaultImageRatio: '1:1',
      uploadPostUser: 'tenantreport',
      facebookPageId: '750158511525291',
      linkedinOrgUrn: 'urn:li:organization:80548299',
      tiktokHandle: 'TenantReport',
      enabledPlatforms: ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    },
    update: {
      brandAbout:
        'Tenant Report is an online tenant screening platform that helps landlords reduce rental risk, screen tenant applicants with background checks and credit reports, and ensure reliable rental income through AI-powered tenant evaluation and rental protection services.',
      brandMission:
        'Reduce risk and ensure reliable income for landlords through smarter tenant screening and property protection.',
      brandServices:
        'Tenant screening reports, Smart Tenant Subscription (AI-powered tenant insights), Rent Promise protection, and property management tools.',
      brandAudience:
        'Landlords and property owners who want confident tenant decisions and peace of mind. Canadian landlords and property managers screening rental applicants.',
      brandWebsite: 'https://tenant-report-app.vercel.app/',
      tone: 'Professional, trustworthy, and landlord-focused. Reassuring and risk-focused without fear-based language.',
      defaultImageRatio: '1:1',
      uploadPostUser: 'tenantreport',
      facebookPageId: '750158511525291',
      linkedinOrgUrn: 'urn:li:organization:80548299',
      tiktokHandle: 'TenantReport',
      enabledPlatforms: ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    },
  });

  console.log('[Prisma] Tenant Report social studio config ready');
}

async function seedAppAdmin() {
  const passwordHash = await bcrypt.hash(APP_ADMIN_PASSWORD, 10);

  const appAdmin = await prisma.user.upsert({
    where: { email: APP_ADMIN_EMAIL },
    update: {
      password: passwordHash,
      role: 'APP_ADMIN',
      name: APP_ADMIN_NAME,
      companyId: null,
    },
    create: {
      email: APP_ADMIN_EMAIL,
      name: APP_ADMIN_NAME,
      password: passwordHash,
      role: 'APP_ADMIN',
      companyId: null,
    },
  });

  console.log('[Prisma] Platform admin ready (APP_ADMIN):', appAdmin.email, `(id: ${appAdmin.id})`);
  return appAdmin;
}

async function main() {
  await ensureIntegrationsTable();
  const company = await ensurePlatformCompany();
  await seedPrismaAdmin(company.id);
  await seedAppAdmin();
  await seedCompanyIntegrationsFromEnv(company.id);
  await seedTenantReportBrandConfig(company.id);
  await seedTenantReportSocialStudioConfig(company.id);
  await seedSupabaseAuthAdmin();
  console.log('\nLogin credentials (Client Dashboard at /client-login):');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('\nPlatform admin (Admin Portal at /admin):');
  console.log(`  Email:    ${APP_ADMIN_EMAIL}`);
  console.log(`  Password: ${APP_ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
