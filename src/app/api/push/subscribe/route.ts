import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, auth: authKey, p256dh } = body;

  if (!endpoint || !authKey || !p256dh) {
    return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: session.user.id,
        endpoint,
      },
    },
    create: {
      userId: session.user.id,
      endpoint,
      auth: authKey,
      p256dh,
    },
    update: {
      auth: authKey,
      p256dh,
    },
  });

  return NextResponse.json({ success: true });
}