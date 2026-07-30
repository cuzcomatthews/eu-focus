import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGuayaquilHour, getTodayString } from '@/lib/timezone';
import { sendPushNotification } from '@/lib/push';
import { createNotification } from '@/lib/notifications';

const SECRET = process.env.CRON_SECRET || 'eu-focus-cron-secret';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hour = getGuayaquilHour();
  const today = getTodayString();

  // 8 AM: Task due date reminders
  if (hour === 8) {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const tasksDue = await prisma.task.findMany({
        where: {
          userId: user.id,
          status: { not: 'done' },
          dueDate: {
            gte: new Date(today + 'T00:00:00-05:00'),
            lte: new Date(today + 'T23:59:59-05:00'),
          },
        },
        select: { id: true, title: true },
      });

      for (const task of tasksDue) {
        await sendPushNotification(user.id, `Tarea pendiente hoy`, `"${task.title}" vence hoy`);
        await createNotification(user.id, 'task_reminder', `Tarea pendiente hoy`, `"${task.title}" vence hoy`, { taskId: task.id });
      }
    }
  }

  // 11 PM: End-of-day checks
  if (hour === 23) {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const dailyLogCount = await prisma.dailyLog.count({
        where: { userId: user.id, date: new Date(today) },
      });

      if (dailyLogCount === 0) {
        await sendPushNotification(user.id, 'Registra tu día', 'No has registrado cómo te fue hoy. Llena tu horario.');
        await createNotification(user.id, 'schedule_reminder', 'Registra tu día', 'No has registrado cómo te fue hoy. Llena tu horario.');
      }

      const checkinCount = await prisma.dailyCheckIn.count({
        where: { userId: user.id, date: new Date(today) },
      });

      if (checkinCount === 0) {
        await sendPushNotification(user.id, 'Check-in pendiente', 'No has hecho tu check-in de hábitos de hoy.');
        await createNotification(user.id, 'habit_reminder', 'Check-in pendiente', 'No has hecho tu check-in de hábitos de hoy.');
      }
    }

    // Auto-delete completed tasks older than 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.task.deleteMany({
      where: { status: 'done', completedAt: { lte: oneDayAgo } },
    });
  }

  return NextResponse.json({ hour, ok: true });
}
