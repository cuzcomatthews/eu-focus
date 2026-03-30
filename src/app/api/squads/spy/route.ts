import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET spy data — view another member's kanban board
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');

  if (!memberId) {
    return NextResponse.json({ error: 'Member ID required' }, { status: 400 });
  }

  // Verify both users share at least one squad
  const sharedSquad = await prisma.squadMember.findFirst({
    where: {
      userId: memberId,
      squad: {
        members: {
          some: { userId: session.user.id }
        }
      }
    }
  });

  if (!sharedSquad) {
    return NextResponse.json({ error: 'Not in a shared squad' }, { status: 403 });
  }

  // Get their tasks
  const tasks = await prisma.task.findMany({
    where: { userId: memberId },
    include: {
      habit: { select: { name: true, color: true, iconSvg: true } },
    },
    orderBy: [{ columnOrder: 'asc' }, { createdAt: 'desc' }],
  });

  // Get their habits with streaks
  const habits = await prisma.habit.findMany({
    where: { userId: memberId },
    include: {
      streaks: {
        where: { type: 'habit' },
        select: { currentCount: true },
      },
    },
  });

  return NextResponse.json({ tasks, habits });
}
