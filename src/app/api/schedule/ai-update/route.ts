import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTodayString, getGuayaquilMidnight } from '@/lib/timezone';

const LLM_URL = process.env.BREAKDOWN_LLM_URL || 'https://api.deepseek.com/chat/completions';
const LLM_KEY = process.env.BREAKDOWN_LLM_API_KEY || '';
const LLM_MODEL = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { message, date: dateStr } = body;
  const date = dateStr || getTodayString();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // Get today's schedule blocks
  const now = new Date();
  const dayOfWeek = parseInt(
    now.toLocaleString('es-EC', { timeZone: 'America/Guayaquil', weekday: 'short' })
      .replace(/^(lun|mar|mié|jue|vie|sáb|dom)$/, (m: string) =>
        ({ lun: '1', mar: '2', mié: '3', jue: '4', vie: '5', sáb: '6', dom: '0' }[m] || '1')
      ),
    10
  );

  const blocks = await prisma.scheduleBlock.findMany({
    where: { userId: session.user.id, dayOfWeek },
    orderBy: { startTime: 'asc' },
  });

  if (blocks.length === 0) {
    return NextResponse.json({ error: 'No hay bloques en tu horario para hoy.' }, { status: 400 });
  }

  const blocksList = blocks.map(b =>
    `- ${b.startTime}-${b.endTime}: ${b.label || b.category} (categoría: ${b.category})`
  ).join('\n');

  const promptText = `Eres un asistente que procesa actualizaciones de horario diario. El usuario te dirá qué hizo en cada bloque de tiempo.

Horario de hoy:
${blocksList}

Mensaje del usuario: "${message}"

Tienes que devolver SOLO un JSON válido (sin markdown, sin explicaciones) con este formato exacto:
{
  "blocks": [
    {
      "startTime": "08:00",
      "endTime": "11:00",
      "status": "completed",
      "missedReason": null
    }
  ]
}

Reglas:
- status DEBE ser uno de: "completed", "missed", "canceled"
- Si status es "missed", missedReason debe ser uno de: "videojuegos", "redes_sociales", "ocio_general", o null
- Si status NO es "missed", missedReason debe ser null
- Si el usuario dice que se canceló algo (clase cancelada, emergencia, etc.), usa "canceled"
- Si el usuario no menciona un bloque, asúmelo como "completed"
- Si el usuario dice que hizo otra cosa o procrastinó, márcalo como "missed" con la razón apropiada
- Interpreta el lenguaje natural: "jugué", "me distraje", "no hice nada", "me puse a ver videos" → missed con razón
- "hice", "trabajé", "avancé", "cumplí", "bien" → completed
- Solo incluye en el JSON los bloques que fueron mencionados o cambiados explícitamente
- Si el usuario dice frases generales como "estuvo bien el día" o "todo normal", asume todo completed`;

  try {
    const llmRes = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const json = await llmRes.json();
    const raw = json.choices?.[0]?.message?.content || '';

    // Extract JSON from response (in case of markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No se pudo interpretar la respuesta. Intenta de nuevo con más detalle.' }, { status: 400 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const dateObj = getGuayaquilMidnight(date);

    // Apply updates
    const results = [];
    for (const update of parsed.blocks || []) {
      const block = blocks.find(b => b.startTime === update.startTime && b.endTime === update.endTime);
      if (!block) continue;

      const log = await prisma.dailyLog.upsert({
        where: {
          userId_date_scheduleBlockId: {
            userId: session.user.id,
            date: dateObj,
            scheduleBlockId: block.id,
          },
        },
        create: {
          userId: session.user.id,
          date: dateObj,
          scheduleBlockId: block.id,
          startTime: block.startTime,
          endTime: block.endTime,
          category: block.category,
          label: block.label,
          status: update.status || 'completed',
          missedReason: update.missedReason || null,
        },
        update: {
          status: update.status || 'completed',
          missedReason: update.missedReason || null,
        },
      });
      results.push(log);
    }

    return NextResponse.json({
      updated: results.length,
      total: blocks.length,
      message: `Se actualizaron ${results.length} de ${blocks.length} bloques.`,
    });
  } catch (err) {
    console.error('AI update error:', err);
    return NextResponse.json({ error: 'Error al procesar con IA. Intenta de nuevo.' }, { status: 500 });
  }
}