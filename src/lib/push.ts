import { prisma } from './prisma';

async function getWebPush() {
  const webpush = require('web-push');
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:eu-focus@example.com';
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_KEY || '';
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  return webpush;
}

export async function sendPushNotification(userId: string, title: string, body: string) {
  try {
    const webpush = await getWebPush();

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'eu-focus-timer',
      data: { url: '/focus' },
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
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
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
            throw err;
          })
      )
    );

    return {
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  } catch {
    return null;
  }
}