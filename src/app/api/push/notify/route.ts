import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { title, body: notifBody } = body;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const webpush = require('web-push');
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:eu-focus@example.com';
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_KEY || '';
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const payload = JSON.stringify({
    title: title || 'EU FOCUS',
    body: notifBody || '',
    icon: '/icons/icon-192.png',
    data: { url: '/focus' },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub: { endpoint: string; auth: string; p256dh: string; id: string }) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { auth: sub.auth, p256dh: sub.p256dh },
          },
          payload
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
          throw err;
        })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ sent, failed });
}