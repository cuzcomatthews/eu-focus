import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const squadId = req.nextUrl.searchParams.get('id');

  if (!squadId) {
    // Return all squads the user is a member of
    const squads = await prisma.squad.findMany({
      where: {
        members: {
          some: { userId: session.user.id }
        }
      },
      include: {
        _count: {
          select: { members: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(squads);
  }

  // Get specific squad
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: {
      members: {
        include: {
          user: { 
            include: { 
              streaks: { where: { type: 'global' } },
              _count: { select: { habits: true } }
            }
          },
        },
      },
      pins: {
        include: { author: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
      activity: {
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      messages: {
        where: { expiresAt: { gt: new Date() } },
        include: { author: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      },
    },
  });

  if (!squad) {
    return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
  }

  const isMember = squad.members.some((m: { userId: string }) => m.userId === session.user!.id);
  if (!isMember) {
     const squadResponsePreview = { ...squad, isMember: false, userId: session.user.id } as any;
     return NextResponse.json(squadResponsePreview);
  }

  // Calculate 7-day focus time leaderboard
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const squadResponse = { ...squad, isMember, userId: session.user.id } as any;

  for (const m of squadResponse.members) {
    const agg = await prisma.pomodoroSession.aggregate({
      where: { userId: m.userId, completed: true, startedAt: { gte: sevenDaysAgo } },
      _sum: { durationMinutes: true }
    });
    m.user.focusTime7d = agg._sum.durationMinutes || 0;
  }
  
  // Sort members by focusTime descending for the leaderboard
  squadResponse.members.sort((a: any, b: any) => b.user.focusTime7d - a.user.focusTime7d);

  return NextResponse.json(squadResponse);
}

// POST — join squad, send message, create pin, or update name
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, squadId } = body;

  if (action === 'create') {
    const { name } = body;
    const squad = await prisma.squad.create({
      data: {
        name: name || 'Nueva Squad',
        members: {
          create: { userId: session.user.id }
        }
      }
    });
    return NextResponse.json(squad, { status: 201 });
  }

  if (action === 'join') {
    const rawJoinValue = typeof squadId === 'string' ? squadId : '';
    const normalizedJoinValue = rawJoinValue
      .replace(/^JOIN-/i, '')
      .trim()
      .toLowerCase();

    if (!normalizedJoinValue) {
      return NextResponse.json({ error: 'Squad code is required' }, { status: 400 });
    }

    const squad = normalizedJoinValue.length >= 20
      ? await prisma.squad.findUnique({
          where: { id: normalizedJoinValue },
          include: { _count: { select: { members: true } }, members: true },
        })
      : await prisma.squad.findFirst({
          where: { id: { startsWith: normalizedJoinValue } },
          include: { _count: { select: { members: true } }, members: true },
          orderBy: { createdAt: 'desc' },
        });

    if (!squad) return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    if (squad._count.members >= squad.maxMembers) {
      return NextResponse.json({ error: 'Squad is full' }, { status: 400 });
    }
    const isMember = squad.members.some(m => m.userId === session.user!.id);
    if (!isMember) {
      await prisma.squadMember.create({
        data: { squadId, userId: session.user.id },
      });
    }
    return NextResponse.json({ success: true, id: squad.id });
  }

  if (action === 'leave') {
    await prisma.squadMember.deleteMany({
      where: { squadId, userId: session.user.id },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'message') {
    const { content, imageUrl } = body;
    if (!content && !imageUrl) return NextResponse.json({ error: 'Content required' }, { status: 400 });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const message = await prisma.squadMessage.create({
      data: {
        squadId,
        authorId: session.user.id,
        content: content || 'Sent an image',
        imageUrl: imageUrl || null,
        expiresAt,
      },
      include: { author: { select: { name: true, avatarUrl: true } } },
    });
    return NextResponse.json(message, { status: 201 });
  }

  if (action === 'pin') {
    const { contentHtml } = body;
    if (!contentHtml) return NextResponse.json({ error: 'Content required' }, { status: 400 });
    const pin = await prisma.squadPin.create({
      data: {
        squadId,
        authorId: session.user.id,
        contentHtml,
      },
      include: { author: { select: { name: true, avatarUrl: true } } },
    });
    return NextResponse.json(pin, { status: 201 });
  }

  if (action === 'rename') {
    const { name } = body;
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    await prisma.squad.update({ where: { id: squadId }, data: { name } });
    return NextResponse.json({ success: true });
  }

  if (action === 'deletePin') {
    const { pinId } = body;
    await prisma.squadPin.delete({ where: { id: pinId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
