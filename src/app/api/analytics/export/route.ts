import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const sessions = await prisma.pomodoroSession.findMany({
    where: { userId },
    include: {
      habit: { select: { name: true } },
      task: { select: { title: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  // Generate CSV
  const header = ['Date', 'Duration (Minutes)', 'Habit', 'Task', 'Completed'];
  const rows = sessions.map((s: any) => [
    s.startedAt.toISOString(),
    s.durationMinutes.toString(),
    `"${s.habit?.name || 'No Habit'}"`,
    `"${s.task?.title || 'No Task'}"`,
    s.completed ? 'Yes' : 'No'
  ]);

  const csvContent = [header.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="eu-focus-analytics-export.csv"',
    },
  });
}
