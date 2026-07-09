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

  const accountabilityEntries = await prisma.dailyCheckIn.findMany({
    where: { userId, date: { gte: thirtyDaysAgo } },
    orderBy: { date: 'asc' },
    select: { date: true, habitScores: true, summary: true },
  });

  const habitsTrend: Record<string, { name: string; emoji: string; scores: { date: string; score: number }[] }> = {};
  const habits = await prisma.accountabilityHabit.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
  });

  for (const h of habits) {
    habitsTrend[h.key] = { name: h.name, emoji: h.emoji, scores: [] };
  }

  for (const entry of accountabilityEntries) {
    const scores = entry.habitScores as Record<string, { score: number | null }>;
    const dateStr = entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : String(entry.date);
    for (const h of habits) {
      const s = scores[h.key];
      if (s && typeof s.score === 'number') {
        habitsTrend[h.key]?.scores.push({ date: dateStr, score: s.score });
      }
    }
  }

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
    habitsTrend,
    heatmap,
    peakHours,
  });
}
