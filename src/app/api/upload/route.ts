import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { auth } from '@/lib/auth';

export async function POST(request: Request): Promise<NextResponse> {
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
  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const fileBytes = await request.arrayBuffer();

  try {
    // Attempt to upload to Vercel Blob
    const blob = await put(`${session.user.id}-${Date.now()}-${safeFilename}`, fileBytes, {
      access: 'public',
      contentType,
    });

    return NextResponse.json(blob);
  } catch (error: unknown) {
    console.error('Vercel Blob upload failed:', error);
    const message = error instanceof Error ? error.message : '';
    
    // If Blob credentials are missing, fall back to an inline data URL so uploads still render.
    if (message.includes('BLOB_READ_WRITE_TOKEN')) {
      const base64 = Buffer.from(fileBytes).toString('base64');
      return NextResponse.json({
        url: `data:${contentType};base64,${base64}`,
        warning: 'Vercel Blob not configured. Stored as inline data URL.',
      });
    }

    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
