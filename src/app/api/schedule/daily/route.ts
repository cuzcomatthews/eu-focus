import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const logs = await prisma.dailyLog.findMany({
    where: { userId: session.user.id, date: new Date(dateStr) },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json({ logs, date: dateStr });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { date, blocks } = body;

  const results = [];
  for (const b of blocks) {
    const log = await prisma.dailyLog.upsert({
      where: {
        userId_date_scheduleBlockId: {
          userId: session.user.id,
          date: new Date(date),
          scheduleBlockId: b.scheduleBlockId || b.id || 'no-block-' + b.startTime,
        },
      },
      create: {
        userId: session.user.id,
        date: new Date(date),
        scheduleBlockId: b.scheduleBlockId || b.id || undefined,
        startTime: b.startTime,
        endTime: b.endTime,
        category: b.category,
        label: b.label || null,
        status: b.status,
        missedReason: b.missedReason || null,
        notes: b.notes || null,
      },
      update: {
        status: b.status,
        missedReason: b.missedReason || null,
        notes: b.notes || null,
      },
    });
    results.push(log);
  }

  return NextResponse.json({ logs: results });
}
