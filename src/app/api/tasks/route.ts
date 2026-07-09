import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET all tasks for user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Cleanup: Auto-delete completed tasks > 5 days old
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  try {
    await prisma.task.deleteMany({
      where: {
        userId,
        status: 'done',
        completedAt: { lt: fiveDaysAgo },
      },
    });
  } catch (error) {
    console.error('Failed to cleanup old tasks:', error);
  }

  const tasks = await prisma.task.findMany({
    where: { userId },
    include: {
      habit: { select: { name: true, color: true, iconSvg: true, emoji: true } },
    },
    orderBy: [{ columnOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(tasks);
}

// POST create task
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { title, habitId, color, dueDate, estimatedPomodoros, descriptionHtml } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      habitId,
      title,
      color: color || '#6366f1',
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedPomodoros: estimatedPomodoros || 1,
      descriptionHtml: descriptionHtml || null,
    },
    include: {
      habit: { select: { name: true, color: true, iconSvg: true, emoji: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}

// PATCH update tasks (for drag-and-drop reordering)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { taskId, status, columnOrder, title, habitId, color, dueDate, estimatedPomodoros, descriptionHtml } = body;

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) {
    updateData.status = status;
    if (status === 'done') {
      updateData.completedAt = new Date();
    }
  }
  if (columnOrder !== undefined) updateData.columnOrder = columnOrder;
  if (title !== undefined) updateData.title = title;
  if (habitId !== undefined) updateData.habitId = habitId;
  if (color !== undefined) updateData.color = color;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
  if (estimatedPomodoros !== undefined) updateData.estimatedPomodoros = estimatedPomodoros;
  if (descriptionHtml !== undefined) updateData.descriptionHtml = descriptionHtml;

  const task = await prisma.task.update({
    where: { id: taskId, userId: session.user.id },
    data: updateData,
    include: {
      habit: { select: { name: true, color: true, iconSvg: true, emoji: true } },
    },
  });

  if (status === 'done') {
    // Add to squad activity feed and update squad streaks if user is in squads
    const memberships = await prisma.squadMember.findMany({
      where: { userId: session.user.id },
      include: { squad: true },
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const membership of memberships) {
      const squadLastActive = membership.squad.lastActiveDate;
      const squadYesterday = new Date(today);
      squadYesterday.setDate(squadYesterday.getDate() - 1);
      
      let squadStreakCount = membership.squad.streakCount;
      let squadUpdateNeeded = false;

      if (!squadLastActive) {
        squadStreakCount = 1;
        squadUpdateNeeded = true;
      } else {
        const squadLastActiveDate = new Date(squadLastActive);
        squadLastActiveDate.setHours(0, 0, 0, 0);
        
        if (squadLastActiveDate < squadYesterday) {
          squadStreakCount = 1;
          squadUpdateNeeded = true;
        } else if (squadLastActiveDate.getTime() === squadYesterday.getTime()) {
          squadStreakCount += 1;
          squadUpdateNeeded = true;
        }
      }

      if (squadUpdateNeeded) {
        await prisma.squad.update({
          where: { id: membership.squadId },
          data: {
            streakCount: squadStreakCount,
            lastActiveDate: new Date(),
          }
        });
      }

      // 2. Add Activity Feed Entry
      const count = await prisma.activityFeedEntry.count({
        where: { squadId: membership.squadId },
      });

      if (count >= 10) {
        const oldest = await prisma.activityFeedEntry.findFirst({
          where: { squadId: membership.squadId },
          orderBy: { createdAt: 'asc' },
        });
        if (oldest) {
          await prisma.activityFeedEntry.delete({ where: { id: oldest.id } });
        }
      }

      await prisma.activityFeedEntry.create({
        data: {
          squadId: membership.squadId,
          userId: session.user.id,
          taskTitle: task.title,
          habitName: 'General',
          durationMinutes: task.estimatedPomodoros * 25, // Fallback guess for activity feed
          taskDescriptionPreview: task.descriptionHtml?.replace(/<[^>]*>/g, '').slice(0, 100) || null,
        },
      });
    }
  }

  return NextResponse.json(task);
}

// DELETE task
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('id');

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
  }

  await prisma.task.delete({
    where: { id: taskId, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
