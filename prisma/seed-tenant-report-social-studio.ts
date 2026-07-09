/**
 * Seed Tenant Report Social Studio config from n8n workflow brand blocks.
 * Run: npx tsx prisma/seed-tenant-report-social-studio.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLATFORM_COMPANY_SLUG = process.env.PLATFORM_COMPANY_SLUG || 'tenant-report';

/** Values extracted from "Tenant Report - Images posts" and "new shorts final - tenant report" n8n workflows */
const TENANT_REPORT_SOCIAL_CONFIG = {
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
};

async function main() {
  const company = await prisma.company.findUnique({
    where: { slug: PLATFORM_COMPANY_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!company) {
    throw new Error(`Company not found for slug: ${PLATFORM_COMPANY_SLUG}`);
  }

  const row = await prisma.socialStudioConfig.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      ...TENANT_REPORT_SOCIAL_CONFIG,
      enabledPlatforms: TENANT_REPORT_SOCIAL_CONFIG.enabledPlatforms,
    },
    update: {
      ...TENANT_REPORT_SOCIAL_CONFIG,
      enabledPlatforms: TENANT_REPORT_SOCIAL_CONFIG.enabledPlatforms,
    },
  });

  console.log('[Social Studio] Tenant Report config ready for', company.name);
  console.log('  companyId:', company.id);
  console.log('  uploadPostUser:', row.uploadPostUser);
  console.log('  facebookPageId:', row.facebookPageId);
  console.log('  linkedinOrgUrn:', row.linkedinOrgUrn);
  console.log('  enabledPlatforms:', row.enabledPlatforms);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
