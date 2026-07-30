import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGuayaquilHour, getGuayaquilDayOfWeek, getTodayString, getCurrentGuayaquilTime } from '@/lib/timezone';
import { sendPushNotification } from '@/lib/push';
import { createNotification } from '@/lib/notifications';

const SECRET = process.env.CRON_SECRET || 'eu-focus-cron-secret';

const CAT_LABELS: Record<string, string> = {
  work: 'Trabajo', class: 'Clase', ocio: 'Descanso', comida: 'Comida',
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const hour = getGuayaquilHour(now);
  const today = getTodayString(now);
  const currentTime = getCurrentGuayaquilTime();
  const dayOfWeek = getGuayaquilDayOfWeek(now);

  // SCHEDULE BLOCK TRANSITIONS — runs every time the cron fires
  const blocksStartingNow = await prisma.scheduleBlock.findMany({
    where: { startTime: currentTime, dayOfWeek },
    distinct: ['userId'],
  });

  if (blocksStartingNow.length > 0) {
    const userIds = [...new Set(blocksStartingNow.map(b => b.userId))];
    
    for (const userId of userIds) {
      const userBlocks = blocksStartingNow.filter(b => b.userId === userId);
      
      for (const block of userBlocks) {
        const catLabel = CAT_LABELS[block.category] || block.category;
        const endTime = block.endTime.substring(0, 5);
        const startTime = block.startTime.substring(0, 5);
        
        await sendPushNotification(
          userId,
          `⏰ ${block.label || catLabel}`,
          `${startTime}–${endTime}: ${block.label || catLabel}`
        );
        await createNotification(
          userId,
          'schedule_transition',
          `⏰ ${block.label || catLabel}`,
          `${startTime}–${endTime}`,
          {}
        );
      }
    }
  }

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
        await sendPushNotification(user.id, '📋 Tarea pendiente hoy', `"${task.title}" vence hoy`);
        await createNotification(user.id, 'task_reminder', '📋 Tarea pendiente hoy', `"${task.title}" vence hoy`, { taskId: task.id });
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
        await sendPushNotification(user.id, '📝 Registra tu día', 'No has registrado cómo te fue hoy. Llena tu horario.');
        await createNotification(user.id, 'schedule_reminder', '📝 Registra tu día', 'No has registrado cómo te fue hoy. Llena tu horario.');
      }

      const checkinCount = await prisma.dailyCheckIn.count({
        where: { userId: user.id, date: new Date(today) },
      });

      if (checkinCount === 0) {
        await sendPushNotification(user.id, '✅ Check-in pendiente', 'No has hecho tu check-in de hábitos de hoy.');
        await createNotification(user.id, 'habit_reminder', '✅ Check-in pendiente', 'No has hecho tu check-in de hábitos de hoy.');
      }
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.task.deleteMany({
      where: { status: 'done', completedAt: { lte: oneDayAgo } },
    });
  }

  return NextResponse.json({ time: currentTime, transitions: blocksStartingNow.length, hour, ok: true });
}