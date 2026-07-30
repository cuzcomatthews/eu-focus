import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const LLM_URL = process.env.BREAKDOWN_LLM_URL || 'https://api.deepseek.com/chat/completions';
const LLM_KEY = process.env.BREAKDOWN_LLM_API_KEY || '';
const LLM_MODEL = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { question } = body;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const logs = await prisma.dailyLog.findMany({
    where: {
      userId: session.user.id,
      date: { gte: new Date(sevenDaysAgo), lte: new Date(today) },
    },
    orderBy: { date: 'asc' },
  });

  if (logs.length === 0) {
    return NextResponse.json({ answer: 'No hay datos de horario para los últimos 7 días. Registra tus bloques diarios primero.' });
  }

  const summary = logs.map((l) => ({
    date: new Date(l.date).toISOString().split('T')[0],
    time: `${l.startTime}-${l.endTime}`,
    category: l.category,
    status: l.status,
    reason: l.missedReason || null,
  }));

  const predefinedQuestions: Record<string, string> = {
    resumen: 'Dame un resumen de cómo estuvo mi semana basado en estos datos de horario.',
    pierdo_tiempo: '¿En qué categoría o bloque pierdo más tiempo? Dame estadísticas.',
    mejoria: '¿Estoy mejorando respecto a días anteriores? Compara tendencias.',
    horas: '¿Cuántas horas trabajé vs cuántas perdí esta semana? Dame números exactos.',
  };

  const promptText = `
Eres un asistente de productividad personal. Analiza los siguientes datos de horario semanal del usuario y responde la pregunta.

Horario de los últimos 7 días (JSON):
${JSON.stringify(summary, null, 2)}

Pregunta del usuario: "${question}"

Responde en español, de forma directa y con datos concretos. Si puedes dar números y porcentajes, hazlo. Sé alentador pero honesto.`;

  try {
    const response = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    const json = await response.json();
    const answer = json.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    return NextResponse.json({ answer, predefinedQuestions });
  } catch (err) {
    console.error('Schedule AI error:', err);
    return NextResponse.json({ answer: 'Error al analizar los datos. Intenta de nuevo.', predefinedQuestions });
  }
}
