import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE 'newsletter%' OR table_name = 'companies' OR table_name LIKE 'social_studio%')
    ORDER BY table_name
  `;
  console.log('Tables:', JSON.stringify(tables, null, 2));

  const companyCols = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'companies'
    ORDER BY ordinal_position
  `;
  console.log('Companies columns:', JSON.stringify(companyCols, null, 2));

  const newsletterCols = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name LIKE 'newsletter%'
    ORDER BY table_name, ordinal_position
  `;
  console.log('Newsletter columns:', JSON.stringify(newsletterCols, null, 2));
} catch (err) {
  console.error(err);
} finally {
  await prisma.$disconnect();
}
