import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPushNotification } from '@/lib/push';

// POST — record a pomodoro completion
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const { taskId, durationMinutes } = body;

  // Create pomodoro session
  const pomodoroSession = await prisma.pomodoroSession.create({
    data: {
      userId,
      taskId: taskId || null,
      habitId: null,
      startedAt: new Date(Date.now() - durationMinutes * 60 * 1000),
      endedAt: new Date(),
      durationMinutes: durationMinutes || 25,
      completed: true,
    },
  });

  // Increment task completed pomodoros
  if (taskId) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        completedPomodoros: { increment: 1 },
        status: 'in_progress',
      },
    });

    // Auto-complete if estimated pomodoros reached
    if (task.completedPomodoros >= task.estimatedPomodoros) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'done', completedAt: new Date() },
      });
    }
  }

  let globalStreakResult = null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const globalStreak = await prisma.streak.findFirst({
    where: { userId, type: 'global', habitId: null },
  });

  if (globalStreak) {
    const lastActive = globalStreak.lastActiveDate;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newCount = globalStreak.currentCount;
    let streakIncreased = false;

    if (!lastActive) {
      newCount = 1;
      streakIncreased = true;
    } else {
      const lastActiveDate = new Date(lastActive);
      lastActiveDate.setHours(0, 0, 0, 0);
      
      if (lastActiveDate < yesterday) {
        newCount = 1;
        streakIncreased = true;
      } else if (lastActiveDate.getTime() === yesterday.getTime()) {
        newCount = globalStreak.currentCount + 1;
        streakIncreased = true;
      }
    }

    const updated = await prisma.streak.update({
      where: { id: globalStreak.id },
      data: {
        currentCount: newCount,
        longestCount: Math.max(newCount, globalStreak.longestCount),
        lastActiveDate: new Date(),
      },
    });
    globalStreakResult = { currentCount: updated.currentCount, increased: streakIncreased };
  } else {
    const created = await prisma.streak.create({
      data: {
        userId,
        type: 'global',
        currentCount: 1,
        longestCount: 1,
        lastActiveDate: new Date(),
      },
    });
    globalStreakResult = { currentCount: created.currentCount, increased: true };
  }

  // Add to squad activity feed and update squad streaks if user is in squads
  const memberships = await prisma.squadMember.findMany({
    where: { userId },
    include: { squad: true },
  });

  for (const membership of memberships) {
    const squadLastActive = membership.squad.lastActiveDate;
    const squadYesterday = new Date(today);
    squadYesterday.setDate(squadYesterday.getDate() - 1);
    
    let squadStreakCount = membership.squad.streakCount;
    let squadUpdateNeeded = false;

    if (!squadLastActive) {
      squadStreakCount = 1;
      squadUpdateNeeded = true;
    } else {
      const squadLastActiveDate = new Date(squadLastActive);
      squadLastActiveDate.setHours(0, 0, 0, 0);
      
      if (squadLastActiveDate < squadYesterday) {
        squadStreakCount = 1;
        squadUpdateNeeded = true;
      } else if (squadLastActiveDate.getTime() === squadYesterday.getTime()) {
        squadStreakCount += 1;
        squadUpdateNeeded = true;
      }
    }

    if (squadUpdateNeeded) {
      await prisma.squad.update({
        where: { id: membership.squadId },
        data: {
          streakCount: squadStreakCount,
          lastActiveDate: new Date(),
        }
      });
    }

    // 2. Add Activity Feed Entry
    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { habit: true },
      });

      if (task) {
        const count = await prisma.activityFeedEntry.count({
          where: { squadId: membership.squadId },
        });

        if (count >= 10) {
          const oldest = await prisma.activityFeedEntry.findFirst({
            where: { squadId: membership.squadId },
            orderBy: { createdAt: 'asc' },
          });
          if (oldest) {
            await prisma.activityFeedEntry.delete({ where: { id: oldest.id } });
          }
        }

        await prisma.activityFeedEntry.create({
          data: {
            squadId: membership.squadId,
            userId,
            taskTitle: task.title,
            habitName: 'General',
            durationMinutes: durationMinutes || 25,
            taskDescriptionPreview: task.descriptionHtml?.replace(/<[^>]*>/g, '').slice(0, 100) || null,
          },
        });
      }
    }
  }

  // Send push notification
  const taskTitle = taskId
    ? (await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } }))?.title || 'your task'
    : 'your session';
  sendPushNotification(userId, 'Pomodoro completed!', `${durationMinutes || 25}min focused on "${taskTitle}"`);

  return NextResponse.json({ pomodoroSession, streak: globalStreakResult }, { status: 201 });
}
