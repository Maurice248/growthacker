import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true, slug: true } });
  console.log('Companies:', JSON.stringify(companies, null, 2));

  const configs = await prisma.socialStudioConfig.findMany();
  console.log('SocialStudioConfigs count:', configs.length);
  for (const c of configs) {
    console.log('Config for companyId:', c.companyId);
    console.log('  brandAbout:', c.brandAbout?.slice(0, 80));
    console.log('  uploadPostUser:', c.uploadPostUser);
  }

  const users = await prisma.user.findMany({ select: { email: true, companyId: true, role: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
