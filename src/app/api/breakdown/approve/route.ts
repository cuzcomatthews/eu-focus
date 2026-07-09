import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractRootNode, getLeafNodes } from '@/lib/breakdown';

function toDescriptionHtml(description: string) {
  const escaped = description
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<p>${escaped}</p>`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const habitId = typeof body.habitId === 'string' ? body.habitId : '';

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const breakdownSession = await prisma.breakdownSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!breakdownSession) {
      return NextResponse.json({ error: 'Breakdown session not found' }, { status: 404 });
    }

    let habit: { id: string; color: string } | null = null;
    if (habitId) {
      habit = await prisma.habit.findFirst({
        where: {
          id: habitId,
          userId,
        },
      });
    }

    const root = extractRootNode(breakdownSession.structuredOutput);
    const leafNodes = getLeafNodes(root);

    if (leafNodes.length === 0) {
      return NextResponse.json({ error: 'No leaf tasks available for creation' }, { status: 400 });
    }

    const createdTasks = await prisma.$transaction(
      leafNodes.map((leaf) =>
        prisma.task.create({
          data: {
            userId,
            habitId: habitId || null,
            title: leaf.title,
            descriptionHtml: toDescriptionHtml(leaf.description),
            estimatedPomodoros: leaf.pomodoroEstimate,
            dueDate: leaf.dueDate ? new Date(leaf.dueDate + 'T23:59:59') : null,
            color: habit?.color || '#6366f1',
            status: 'todo',
          },
          select: {
            id: true,
            title: true,
            estimatedPomodoros: true,
            dueDate: true,
          },
        })
      )
    );

    await prisma.breakdownSession.update({
      where: { id: breakdownSession.id },
      data: { status: 'approved' },
    });

    return NextResponse.json({
      createdCount: createdTasks.length,
      tasks: createdTasks,
      status: 'approved',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve breakdown';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
