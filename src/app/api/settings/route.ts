import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { timezone, focusDuration, breakDuration, longBreakDuration, name, image } = body;

  const updateData: Record<string, unknown> = {};
  if (timezone) updateData.timezone = timezone;
  if (focusDuration) updateData.focusDuration = focusDuration;
  if (breakDuration) updateData.breakDuration = breakDuration;
  if (longBreakDuration) updateData.longBreakDuration = longBreakDuration;
  if (name) updateData.name = name;
  if (image) updateData.image = image;

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json({ success: true });
}
