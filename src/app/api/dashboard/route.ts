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
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentCheckIns = await prisma.dailyCheckIn.findMany({
    where: { userId, date: { gte: weekAgo, lte: today } },
    select: { habitScores: true },
  });

  let habitHealth = 0;
  if (recentCheckIns.length > 0) {
    const allScores: number[] = [];
    for (const ci of recentCheckIns) {
      const scores = ci.habitScores as Record<string, { score: number | null }>;
      for (const v of Object.values(scores)) {
        if (typeof v?.score === 'number') allScores.push(v.score);
      }
    }
    habitHealth = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;
  }

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
          dueDate: nextTask.dueDate?.toISOString() || null,
          estimatedPomodoros: nextTask.estimatedPomodoros,
          completedPomodoros: nextTask.completedPomodoros,
        }
      : null,
    squadActivity: squadActivity.map((a) => ({
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
