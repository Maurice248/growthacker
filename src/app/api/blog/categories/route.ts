export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireApiCompanyId } from '@/lib/api-auth';
import {
  createBlogCategory,
  deleteBlogCategory,
  listBlogCategories,
  seedDefaultCategoriesIfEmpty,
  updateBlogCategory,
} from '@/lib/blog/categories';

export async function GET() {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const categories = await seedDefaultCategoriesIfEmpty(companyId);
  return NextResponse.json({ categories, source: 'database' });
}

export async function POST(request: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  try {
    const body = await request.json();

    if (!body.category?.trim()) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map(String)
      : typeof body.keywords === 'string'
        ? body.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        : [];

    const category = await createBlogCategory(companyId, {
      service: String(body.service || '').trim(),
      category: String(body.category).trim(),
      seedKeyword: String(body.seedKeyword || body.seed_keyword || '').trim(),
      keywords,
      sortOrder: Number(body.sortOrder ?? body.sort_order ?? 0),
      active: body.active !== false,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('[API blog/categories POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const keywords =
      body.keywords !== undefined
        ? Array.isArray(body.keywords)
          ? body.keywords.map(String)
          : String(body.keywords)
              .split(',')
              .map((k: string) => k.trim())
              .filter(Boolean)
        : undefined;

    const category = await updateBlogCategory(companyId, id, {
      service: body.service !== undefined ? String(body.service).trim() : undefined,
      category: body.category !== undefined ? String(body.category).trim() : undefined,
      seedKeyword:
        body.seedKeyword !== undefined
          ? String(body.seedKeyword).trim()
          : body.seed_keyword !== undefined
            ? String(body.seed_keyword).trim()
            : undefined,
      keywords,
      sortOrder:
        body.sortOrder !== undefined
          ? Number(body.sortOrder)
          : body.sort_order !== undefined
            ? Number(body.sort_order)
            : undefined,
      active: body.active,
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('[API blog/categories PUT]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const companyId = await requireApiCompanyId();
  if (companyId instanceof NextResponse) return companyId;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const ok = await deleteBlogCategory(companyId, id);
  if (!ok) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
