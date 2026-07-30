import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { seedScheduleForUser } from '@/lib/seedSchedule';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get('reset') === 'true') {
    await prisma.scheduleBlock.deleteMany({ where: { userId: session.user.id } });
  }

  await seedScheduleForUser(session.user.id);

  const blocks = await prisma.scheduleBlock.findMany({
    where: { userId: session.user.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  return NextResponse.json({ blocks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const block = await prisma.scheduleBlock.create({
    data: {
      userId: session.user.id,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      category: body.category || 'work',
      label: body.label || null,
    },
  });

  return NextResponse.json({ block }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.scheduleBlock.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
