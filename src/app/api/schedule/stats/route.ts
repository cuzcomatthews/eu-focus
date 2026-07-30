import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: Record<string, unknown> = { userId: session.user.id };
  if (from) where.date = { ...(where.date as object || {}), gte: new Date(from) };
  if (to) where.date = { ...(where.date as object || {}), lte: new Date(to) };

  const logs = await prisma.dailyLog.findMany({
    where: where as never,
    orderBy: { date: 'asc' },
  });

  const byDay: Record<string, { completed: number; missed: number; canceled: number; total: number }> = {};
  let totalCompleted = 0;
  let totalMissed = 0;

  for (const log of logs) {
    const d = new Date(log.date).toISOString().split('T')[0];
    if (!byDay[d]) byDay[d] = { completed: 0, missed: 0, canceled: 0, total: 0 };
    byDay[d].total++;
    if (log.status === 'completed') { byDay[d].completed++; totalCompleted++; }
    else if (log.status === 'missed') { byDay[d].missed++; totalMissed++; }
    else if (log.status === 'canceled') { byDay[d].canceled++; }
  }

  // Compute hours
  const hoursCompleted = logs.filter(l => l.status === 'completed').length * 0.5;
  const hoursMissed = logs.filter(l => l.status === 'missed').length * 0.5;

  return NextResponse.json({ byDay, totalCompleted, totalMissed, hoursCompleted: Math.round(hoursCompleted * 10) / 10, hoursMissed: Math.round(hoursMissed * 10) / 10, totalBlocks: logs.length });
}
