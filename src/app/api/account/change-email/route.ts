export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getRequestUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const userId = await getRequestUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (newEmail === user.email.toLowerCase()) {
      return NextResponse.json({ error: 'New email must be different from your current email.' }, { status: 400 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'That email address is already in use.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[account/change-email]', err);
    return NextResponse.json({ error: 'Failed to change email.' }, { status: 500 });
  }
}
