import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DEFAULT_HABIT_KEYS } from '@/lib/accountability';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const habits = await prisma.accountabilityHabit.findMany({
    where: { userId: session.user.id },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json(habits);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const { name, emoji, description } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const safeKey = 'custom_' + Date.now();

  const count = await prisma.accountabilityHabit.count({ where: { userId } });

  const habit = await prisma.accountabilityHabit.create({
    data: {
      userId,
      key: safeKey,
      name: name.trim(),
      emoji: emoji || '📋',
      description: description || '',
      isDefault: false,
      sortOrder: count,
    },
  });

  return NextResponse.json(habit, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Habit ID required' }, { status: 400 });
  }

  const habit = await prisma.accountabilityHabit.findUnique({ where: { id } });

  if (!habit || habit.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (habit.isDefault || DEFAULT_HABIT_KEYS.includes(habit.key)) {
    return NextResponse.json({ error: 'No se pueden eliminar hábitos por defecto' }, { status: 400 });
  }

  await prisma.accountabilityHabit.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
