export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim();

  if (!token) {
    return new NextResponse(
      '<html><body><h1>Invalid unsubscribe link</h1></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const subscriber = await prisma.newsletterSubscriber.findFirst({
    where: { unsubscribeToken: token },
  });

  if (!subscriber) {
    return new NextResponse(
      '<html><body><h1>Subscriber not found</h1></body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { status: 'unsubscribed' },
  });

  return new NextResponse(
    `<html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
      <h1>You have been unsubscribed</h1>
      <p>${subscriber.email} will no longer receive newsletter emails.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}
