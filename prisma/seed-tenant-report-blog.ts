/**
 * Seed Tenant Report BlogConfig prompts from n8n workflow.
 * Run: npx tsx prisma/seed-tenant-report-blog.ts
 */
import { PrismaClient } from '@prisma/client';
import { upsertCompanyApiTokenSecrets } from '../src/lib/api-token-secrets';
import { TENANT_REPORT_BLOG_PROMPTS } from '../src/lib/blog/tenant-report-prompts';

const prisma = new PrismaClient();

const PLATFORM_COMPANY_SLUG = process.env.PLATFORM_COMPANY_SLUG || 'tenant-report';

async function ensureTitleUserPromptColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "blog_configs" ADD COLUMN IF NOT EXISTS "title_user_prompt" TEXT NOT NULL DEFAULT '';
  `);
}

async function main() {
  await ensureTitleUserPromptColumn();

  const company = await prisma.company.findUnique({
    where: { slug: PLATFORM_COMPANY_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!company) {
    throw new Error(`Company not found for slug: ${PLATFORM_COMPANY_SLUG}`);
  }

  const row = await prisma.blogConfig.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      ...TENANT_REPORT_BLOG_PROMPTS,
      runHour: 7,
      runMinute: 0,
      runTimezone: 'UTC',
      daysInterval: 3,
      active: true,
      postStatus: 'publish',
      imageSize: '16:9',
      dataForSeoLocationCode: 2124,
      openAiModel: 'gpt-4o-mini',
    },
    update: {
      ...TENANT_REPORT_BLOG_PROMPTS,
    },
  });

  console.log('[Blog] Tenant Report prompts ready for', company.name);
  console.log('  companyId:', company.id);
  console.log('  titlePrompt chars:', row.titlePrompt.length);
  console.log('  titleUserPrompt chars:', row.titleUserPrompt.length);
  console.log('  articleSystemPrompt chars:', row.articleSystemPrompt.length);
  console.log('  articleUserPrompt chars:', row.articleUserPrompt.length);
  console.log('  imagePromptSystem chars:', row.imagePromptSystem.length);

  const dataforseoCredential =
    process.env.DATAFORSEO_CREDENTIAL?.trim() ||
    (process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim()
      ? `${process.env.DATAFORSEO_LOGIN.trim()}:${process.env.DATAFORSEO_PASSWORD.trim()}`
      : undefined);

  if (dataforseoCredential) {
    await upsertCompanyApiTokenSecrets(company.id, { dataforseo: dataforseoCredential });
    console.log('  dataforseo: saved from DATAFORSEO_* env');
  } else {
    console.log(
      '  dataforseo: skipped (set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD or DATAFORSEO_CREDENTIAL to seed)'
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
