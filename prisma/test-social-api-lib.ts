import { PrismaClient } from '@prisma/client';
import { getSocialStudioConfig, resolveSocialContext } from '../src/lib/social-studio/config';

const prisma = new PrismaClient();
const TENANT_REPORT_ID = 'cmr2exoyh000013m6l1fpf0s0';

async function main() {
  console.log('has socialStudioConfig:', 'socialStudioConfig' in prisma);

  const config = await getSocialStudioConfig(TENANT_REPORT_ID);
  console.log('getSocialStudioConfig:', config ? 'found' : 'null');
  if (config) {
    console.log('  brandAbout length:', config.brandAbout.length);
    console.log('  uploadPostUser:', config.uploadPostUser);
  }

  const ctx = await resolveSocialContext(TENANT_REPORT_ID);
  console.log('resolveSocialContext companyName:', ctx.companyName);
}

main()
  .catch((e) => console.error('ERROR:', e))
  .finally(() => prisma.$disconnect());
