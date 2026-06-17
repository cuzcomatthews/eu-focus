import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentSessions = await prisma.pomodoroSession.findMany({
    where: { userId, completed: true, startedAt: { gte: thirtyDaysAgo } },
    select: { durationMinutes: true, startedAt: true, habitId: true },
  });

  const allSessions = await prisma.pomodoroSession.findMany({
    where: { userId, completed: true },
    select: { durationMinutes: true, startedAt: true, habitId: true },
  });

  const totalPomodorosAllTime = allSessions.length;
  const totalMinutesAllTime = allSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const recentPomodoros = recentSessions.length;
  const recentMinutes = recentSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const habits = await prisma.habit.findMany({ where: { userId } });
  const timeByHabit = habits.map(h => ({
    name: h.name,
    color: h.color,
    minutes: recentSessions.filter(s => s.habitId === h.id).reduce((sum, s) => sum + s.durationMinutes, 0),
  })).filter(h => h.minutes > 0);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const heatmapSessions = allSessions.filter(s => s.startedAt >= oneYearAgo);
  const heatmap: Record<string, number> = {};
  heatmapSessions.forEach(s => {
    const day = s.startedAt.toISOString().split('T')[0];
    heatmap[day] = (heatmap[day] || 0) + s.durationMinutes;
  });

  const peakHours: number[] = Array.from({ length: 24 }, () => 0);
  recentSessions.forEach(s => {
    const hour = s.startedAt.getHours();
    peakHours[hour] += s.durationMinutes;
  });

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const sessionsLast7d = recentSessions.filter(s => s.startedAt >= last7Days);
  const uniqueDaysLast7d = new Set(sessionsLast7d.map(s => s.startedAt.toISOString().split('T')[0])).size;

  const dailyAvgMinutes = recentSessions.length > 0
    ? Math.round(recentMinutes / Math.max(1, new Set(recentSessions.map(s => s.startedAt.toISOString().split('T')[0])).size))
    : 0;

  return NextResponse.json({
    totalPomodoros: totalPomodorosAllTime,
    totalMinutes: totalMinutesAllTime,
    recentPomodoros,
    recentMinutes,
    uniqueDaysLast7d,
    dailyAvgMinutes,
    timeByHabit,
    heatmap,
    peakHours,
  });
}
