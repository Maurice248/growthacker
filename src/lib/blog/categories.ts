import { prisma } from '@/lib/prisma';
import { BLOG_CATEGORIES } from '@/lib/blog-categories';
import type { BlogCategoryData } from './types';

function rowToCategory(row: {
  id: string;
  service: string;
  category: string;
  seedKeyword: string;
  keywords: unknown;
  sortOrder: number;
  active: boolean;
}): BlogCategoryData {
  const keywords = Array.isArray(row.keywords)
    ? (row.keywords as string[])
    : typeof row.keywords === 'string'
      ? (JSON.parse(row.keywords) as string[])
      : [];

  return {
    id: row.id,
    service: row.service,
    category: row.category,
    seedKeyword: row.seedKeyword,
    keywords,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

export async function seedDefaultCategoriesIfEmpty(companyId: string): Promise<BlogCategoryData[]> {
  const count = await prisma.blogCategory.count({ where: { companyId } });
  if (count > 0) {
    return listBlogCategories(companyId);
  }

  await prisma.blogCategory.createMany({
    data: BLOG_CATEGORIES.map((cat, index) => ({
      companyId,
      service: cat.service,
      category: cat.category,
      seedKeyword: cat.seed_keyword,
      keywords: cat.keywords,
      sortOrder: index,
      active: true,
    })),
  });

  return listBlogCategories(companyId);
}

export async function listBlogCategories(companyId: string, activeOnly = false) {
  const rows = await prisma.blogCategory.findMany({
    where: {
      companyId,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return rows.map(rowToCategory);
}

export async function getBlogCategoryById(companyId: string, categoryId: string) {
  const row = await prisma.blogCategory.findFirst({
    where: { id: categoryId, companyId },
  });
  return row ? rowToCategory(row) : null;
}

export async function createBlogCategory(
  companyId: string,
  input: Omit<BlogCategoryData, 'id'>
) {
  const row = await prisma.blogCategory.create({
    data: {
      companyId,
      service: input.service,
      category: input.category,
      seedKeyword: input.seedKeyword,
      keywords: input.keywords,
      sortOrder: input.sortOrder,
      active: input.active ?? true,
    },
  });
  return rowToCategory(row);
}

export async function updateBlogCategory(
  companyId: string,
  categoryId: string,
  input: Partial<Omit<BlogCategoryData, 'id'>>
) {
  const existing = await prisma.blogCategory.findFirst({
    where: { id: categoryId, companyId },
  });
  if (!existing) return null;

  const row = await prisma.blogCategory.update({
    where: { id: categoryId },
    data: {
      ...(input.service !== undefined ? { service: input.service } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.seedKeyword !== undefined ? { seedKeyword: input.seedKeyword } : {}),
      ...(input.keywords !== undefined ? { keywords: input.keywords } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });

  return rowToCategory(row);
}

export async function deleteBlogCategory(companyId: string, categoryId: string) {
  const existing = await prisma.blogCategory.findFirst({
    where: { id: categoryId, companyId },
  });
  if (!existing) return false;
  await prisma.blogCategory.delete({ where: { id: categoryId } });
  return true;
}

export async function pickRotatedCategory(companyId: string): Promise<BlogCategoryData | null> {
  const categories = await listBlogCategories(companyId, true);
  if (!categories.length) return null;

  const config = await prisma.blogConfig.findUnique({ where: { companyId } });
  const index = config?.lastCategoryIndex ?? 0;
  const category = categories[index % categories.length];

  await prisma.blogConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      lastCategoryIndex: (index + 1) % categories.length,
    },
    update: {
      lastCategoryIndex: (index + 1) % categories.length,
    },
  });

  return category;
}
