import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET all habits for user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id },
    include: {
      streaks: {
        where: { type: 'habit' },
        select: { currentCount: true, longestCount: true },
      },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(habits);
}

// POST create habit
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, iconSvg, emoji, color, recurrenceType, recurrenceCount, recurrenceDays } = body;

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const habit = await prisma.habit.create({
    data: {
      userId: session.user.id,
      name,
      iconSvg: iconSvg || 'book',
      emoji: emoji || '📚',
      color: color || '#6366f1',
      recurrenceType: recurrenceType || 'daily',
      recurrenceCount: recurrenceCount || 1,
      recurrenceDays: recurrenceDays || '',
    },
  });

  // Create habit streak record
  await prisma.streak.create({
    data: {
      userId: session.user.id,
      type: 'habit',
      habitId: habit.id,
    },
  });

  return NextResponse.json(habit, { status: 201 });
}

// PATCH update habit
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { habitId, name, iconSvg, emoji, color, recurrenceType, recurrenceCount, recurrenceDays } = body;

  if (!habitId) {
    return NextResponse.json({ error: 'Habit ID required' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (iconSvg !== undefined) updateData.iconSvg = iconSvg;
  if (emoji !== undefined) updateData.emoji = emoji;
  if (color !== undefined) updateData.color = color;
  if (recurrenceType !== undefined) updateData.recurrenceType = recurrenceType;
  if (recurrenceCount !== undefined) updateData.recurrenceCount = recurrenceCount;
  if (recurrenceDays !== undefined) updateData.recurrenceDays = recurrenceDays;

  const habit = await prisma.habit.update({
    where: { id: habitId, userId: session.user.id },
    data: updateData,
  });

  return NextResponse.json(habit);
}

// DELETE habit
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const habitId = searchParams.get('id');

  if (!habitId) {
    return NextResponse.json({ error: 'Habit ID required' }, { status: 400 });
  }

  await prisma.habit.delete({
    where: { id: habitId, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
