import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTodayString, getGuayaquilMidnight } from '@/lib/timezone';
import { parseJsonResponse } from '@/lib/breakdown';

const LLM_URL = process.env.BREAKDOWN_LLM_URL || 'https://api.deepseek.com/chat/completions';
const LLM_KEY = process.env.BREAKDOWN_LLM_API_KEY || '';
const LLM_MODEL = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';

const SYSTEM_PROMPT = `Eres un asistente de productividad. Tu tarea es analizar el mensaje del usuario y actualizar los bloques de su horario diario.

El usuario te dirá qué hizo en cada bloque — o qué NO hizo. Tu trabajo es convertir eso en un JSON con actualizaciones.

## REGLAS ESTRICTAS

1. **status** debe ser EXACTAMENTE uno de: "completed", "missed", "canceled"
2. Si status es "missed", **missedReason** debe ser uno de: "videojuegos", "redes_sociales", "ocio_general"
3. Si status NO es "missed", missedReason debe ser null SIEMPRE
4. Solo incluye en el JSON los bloques que el usuario menciona explícitamente — no incluyas todos
5. Si el usuario no menciona un bloque, NO lo incluyas en la respuesta

## INTERPRETACIÓN DEL LENGUAJE

**→ completed:** "hice", "trabajé", "avancé", "cumplí", "terminé", "bien", "normal", "lo hice", "sí hice"
**→ missed (videojuegos):** "jugué", "me puse a jugar", "gaming", "partida", "play", "xbox", "playstation"
**→ missed (redes_sociales):** "redes", "instagram", "tiktok", "twitter", "scrolling", "videos", "youtube", "whatsapp"
**→ missed (ocio_general):** "no hice nada", "procrastiné", "me distraje", "descansé de más", "me dormí", "vi series"
**→ canceled:** "cancelado", "cancelaron", "no hubo clase", "emergencia", "imprevisto", "no se pudo"

## EJEMPLOS

Usuario: "De 8 a 11 trabajé en la tesis, de 11 a 11:30 jugué videojuegos"
→ {"blocks":[{"startTime":"08:00","endTime":"11:00","status":"completed","missedReason":null},{"startTime":"11:00","endTime":"11:30","status":"missed","missedReason":"videojuegos"}]}

Usuario: "Cancelaron la clase de la tarde, todo lo demás bien"
→ {"blocks":[{"startTime":"14:00","endTime":"17:00","status":"canceled","missedReason":null}]}

Usuario: "Hoy todo bien, cumplí con todo"
→ {"blocks":[]}

Responde SOLO con JSON válido. Sin markdown, sin explicaciones.`;

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
    `- ${b.startTime}-${b.endTime}: ${b.label || b.category} (${b.category})`
  ).join('\n');

  const userPrompt = `Horario de hoy:\n${blocksList}\n\nMensaje del usuario: "${message}"`;

  try {
    const llmRes = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      return NextResponse.json({ error: `LLM error: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    const json = await llmRes.json();
    const raw = json.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      parsed = parseJsonResponse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json({ error: 'No se pudo interpretar la respuesta. Intenta con más detalle.' }, { status: 400 });
      }
      parsed = JSON.parse(match[0]);
    }

    const dateObj = getGuayaquilMidnight(date);
    const results = [];

    for (const update of parsed.blocks || []) {
      const block = blocks.find(b => b.startTime === update.startTime && b.endTime === update.endTime);
      if (!block) continue;
      if (!['completed', 'missed', 'canceled'].includes(update.status)) continue;

      const log = await prisma.dailyLog.upsert({
        where: {
          userId_date_scheduleBlockId: {
            userId: session.user.id,
            date: dateObj,
            scheduleBlockId: block.id,
          },
        },
        create: {
          userId: session.user.id, date: dateObj, scheduleBlockId: block.id,
          startTime: block.startTime, endTime: block.endTime,
          category: block.category, label: block.label,
          status: update.status,
          missedReason: update.status === 'missed' ? (update.missedReason || 'ocio_general') : null,
        },
        update: {
          status: update.status,
          missedReason: update.status === 'missed' ? (update.missedReason || 'ocio_general') : null,
        },
      });
      results.push(log);
    }

    return NextResponse.json({
      updated: results.length,
      total: blocks.length,
      message: results.length > 0
        ? `Se actualizaron ${results.length} bloques.`
        : 'No se encontraron bloques para actualizar con lo que dijiste.',
    });
  } catch (err) {
    console.error('AI update error:', err);
    return NextResponse.json({ error: 'Error al procesar con IA. Intenta de nuevo.' }, { status: 500 });
  }
}