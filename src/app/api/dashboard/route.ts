import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get global streak
  const globalStreak = await prisma.streak.findFirst({
    where: { userId, type: 'global' },
  });

  // Get today's pomodoros
  const todayPomodoros = await prisma.pomodoroSession.count({
    where: {
      userId,
      completed: true,
      startedAt: { gte: startOfDay },
    },
  });

  // Get next task (closest due date)
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

  // Get habits with streaks
  const habits = await prisma.habit.findMany({
    where: { userId },
    include: {
      streaks: {
        where: { type: 'habit' },
        select: { currentCount: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get recent squad activity
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

  // Calculate Real Rings Metrics
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

  const habitsWithStreak = habits.filter((h: any) => h.streaks?.[0]?.currentCount > 0).length;
  const habitHealth = habits.length > 0 ? Math.round((habitsWithStreak / habits.length) * 100) : 0;
  
  const dailyGoal = 8; // Assumed 8 pomodoros daily goal
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
    habits: habits.map((h: any) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      emoji: h.emoji,
      iconSvg: h.iconSvg,
      streak: h.streaks[0]?.currentCount || 0,
    })),
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
