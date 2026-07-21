export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ensureCompanyBrandConfig } from '@/lib/company-brand-config';
import { ensureCompanyModuleAccess } from '@/lib/company-module-access';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base) || 'company';
  let candidate = slug;
  let suffix = 1;

  while (await prisma.company.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!adminName) {
      return NextResponse.json({ error: 'Admin name is required.' }, { status: 400 });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const emailLocal = email.split('@')[0] || adminName || 'workspace';
    const slug = await uniqueSlug(companyName || emailLocal);
    const hashedPassword = await bcrypt.hash(password, 12);

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: companyName || adminName || 'My Company',
          slug,
          logoUrl: null,
        },
      });

      await tx.user.create({
        data: {
          email,
          name: adminName,
          password: hashedPassword,
          role: 'COMPANY_ADMIN',
          companyId: created.id,
        },
      });

      return created;
    });

    await ensureCompanyBrandConfig(company.id);
    await ensureCompanyModuleAccess(company.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[companies/register]', err);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
