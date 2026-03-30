import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Total pomodoros and time
  const allSessions = await prisma.pomodoroSession.findMany({
    where: { userId, completed: true },
    select: { durationMinutes: true, startedAt: true, habitId: true },
  });

  const totalPomodoros = allSessions.length;
  const totalMinutes = allSessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  // Time per habit
  const habits = await prisma.habit.findMany({ where: { userId } });
  const timeByHabit = habits.map(h => ({
    name: h.name,
    color: h.color,
    minutes: allSessions.filter(s => s.habitId === h.id).reduce((sum, s) => sum + s.durationMinutes, 0),
  }));

  // Heatmap data (last 365 days)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const heatmapSessions = allSessions.filter(s => s.startedAt >= oneYearAgo);
  const heatmap: Record<string, number> = {};
  heatmapSessions.forEach(s => {
    const day = s.startedAt.toISOString().split('T')[0];
    heatmap[day] = (heatmap[day] || 0) + s.durationMinutes;
  });

  // Peak hours
  const peakHours: number[] = Array.from({ length: 24 }, () => 0);
  allSessions.forEach(s => {
    const hour = s.startedAt.getHours();
    peakHours[hour] += s.durationMinutes;
  });

  return NextResponse.json({
    totalPomodoros,
    totalMinutes,
    timeByHabit,
    heatmap,
    peakHours,
  });
}
