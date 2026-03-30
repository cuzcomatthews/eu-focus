import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const files = await prisma.audioFile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, blobUrl: true, createdAt: true },
  });

  return NextResponse.json(
    files.map((file) => ({
      id: file.id,
      name: file.name,
      url: file.blobUrl,
      createdAt: file.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');
  if (!filename) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const label = safeFilename.replace(/\.[^.]+$/, '').slice(0, 60) || 'Custom sound';
  const contentType = request.headers.get('content-type') || 'audio/mpeg';
  const fileBytes = await request.arrayBuffer();

  let url: string;
  try {
    const blob = await put(`${session.user.id}-${Date.now()}-${safeFilename}`, fileBytes, {
      access: 'public',
      contentType,
    });
    url = blob.url;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('BLOB_READ_WRITE_TOKEN')) {
      console.error('Audio upload failed:', error);
      return NextResponse.json({ error: 'Failed to upload audio file' }, { status: 500 });
    }

    // Blob is not configured; keep a functional fallback that still persists in Neon.
    const base64 = Buffer.from(fileBytes).toString('base64');
    url = `data:${contentType};base64,${base64}`;
  }

  const audioFile = await prisma.audioFile.create({
    data: {
      userId: session.user.id,
      name: label,
      blobUrl: url,
    },
    select: { id: true, name: true, blobUrl: true, createdAt: true },
  });

  return NextResponse.json(
    {
      id: audioFile.id,
      name: audioFile.name,
      url: audioFile.blobUrl,
      createdAt: audioFile.createdAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Audio file ID required' }, { status: 400 });
  }

  await prisma.audioFile.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
