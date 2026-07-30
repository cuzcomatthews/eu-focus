import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { transcribeAudio } from '@/lib/deepgram';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 });
    }

    const audioData = await audioFile.arrayBuffer();
    const text = await transcribeAudio(audioData, audioFile.type || 'audio/webm');
    return NextResponse.json({ text });
  } catch (err) {
    console.error('Deepgram error:', err);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
