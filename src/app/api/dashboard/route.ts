import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function isStreakBroken(lastActiveDate: Date | null): boolean {
  if (!lastActiveDate) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastActive = new Date(lastActiveDate);
  lastActive.setHours(0, 0, 0, 0);
  return lastActive < yesterday;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let globalStreak = await prisma.streak.findFirst({
    where: { userId, type: 'global' },
  });

  if (globalStreak && isStreakBroken(globalStreak.lastActiveDate)) {
    globalStreak = await prisma.streak.update({
      where: { id: globalStreak.id },
      data: { currentCount: 0 },
    });
  }

  const todayPomodoros = await prisma.pomodoroSession.count({
    where: {
      userId,
      completed: true,
      startedAt: { gte: startOfDay },
    },
  });

  const nextTask = await prisma.task.findFirst({
    where: {
      userId,
      status: { in: ['todo', 'in_progress'] },
    },
    orderBy: [
      { dueDate: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      habit: { select: { name: true } },
    },
  });

  const habits = await prisma.habit.findMany({
    where: { userId },
    include: {
      streaks: {
        where: { type: 'habit' },
        select: { id: true, currentCount: true, lastActiveDate: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const habitsWithRecalculatedStreaks = await Promise.all(
    habits.map(async (h) => {
      const habitStreak = h.streaks[0];
      let effectiveStreak = habitStreak?.currentCount || 0;

      if (habitStreak && isStreakBroken(habitStreak.lastActiveDate)) {
        effectiveStreak = 0;
        await prisma.streak.update({
          where: { id: habitStreak.id },
          data: { currentCount: 0 },
        }).catch(() => {});
      }

      return {
        id: h.id,
        name: h.name,
        color: h.color,
        emoji: h.emoji,
        iconSvg: h.iconSvg,
        streak: effectiveStreak,
      };
    })
  );

  const squadMemberships = await prisma.squadMember.findMany({
    where: { userId },
    select: { squadId: true },
  });
  const squadIds = squadMemberships.map((sm: { squadId: string }) => sm.squadId);

  const squadActivity = await prisma.activityFeedEntry.findMany({
    where: { squadId: { in: squadIds } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      user: { select: { name: true, avatarUrl: true } }
    }
  });

  const last7Days = new Date(now);
  last7Days.setDate(last7Days.getDate() - 7);
  
  const allSessions7d = await prisma.pomodoroSession.findMany({
    where: { userId, startedAt: { gte: last7Days } },
    select: { completed: true, startedAt: true }
  });

  const uniqueDaysFocus = new Set(
    allSessions7d.filter((s: { completed: boolean; startedAt: Date }) => s.completed).map((s: { startedAt: Date }) => s.startedAt.toISOString().split('T')[0])
  ).size;
  const weeklyConsistency = Math.round((uniqueDaysFocus / 7) * 100);

  const completedSessionCount = allSessions7d.filter((s: { completed: boolean }) => s.completed).length;
  const completionRate = allSessions7d.length > 0 ? Math.round((completedSessionCount / allSessions7d.length) * 100) : 0;

  const habitsWithStreak = habitsWithRecalculatedStreaks.filter((h) => h.streak > 0).length;
  const habitHealth = habits.length > 0 ? Math.round((habitsWithStreak / habits.length) * 100) : 0;
  
  const dailyGoal = 8;
  const dailyGoalProgress = Math.min(Math.round((todayPomodoros / dailyGoal) * 100), 100);

  return NextResponse.json({
    streak: globalStreak?.currentCount || 0,
    longestStreak: globalStreak?.longestCount || 0,
    todayPomodoros,
    nextTask: nextTask
      ? {
          id: nextTask.id,
          title: nextTask.title,
          habitName: nextTask.habit.name,
          dueDate: nextTask.dueDate?.toISOString() || null,
          estimatedPomodoros: nextTask.estimatedPomodoros,
          completedPomodoros: nextTask.completedPomodoros,
        }
      : null,
    habits: habitsWithRecalculatedStreaks,
    squadActivity: squadActivity.map((a: any) => ({
      id: a.id,
      userName: a.user.name || 'User',
      userAvatar: a.user.avatarUrl || null,
      taskTitle: a.taskTitle,
      durationMinutes: a.durationMinutes,
      createdAt: a.createdAt.toISOString(),
    })),
    analytics: {
      weeklyConsistency,
      completionRate,
      habitHealth,
      dailyGoalProgress,
    }
  });
}
