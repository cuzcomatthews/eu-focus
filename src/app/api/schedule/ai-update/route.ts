import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTodayString, getGuayaquilMidnight } from '@/lib/timezone';
import { parseJsonResponse } from '@/lib/breakdown';

const LLM_URL = process.env.BREAKDOWN_LLM_URL || 'https://api.deepseek.com/chat/completions';
const LLM_KEY = process.env.BREAKDOWN_LLM_API_KEY || '';
const LLM_MODEL = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';

const DAY_MAP: Record<string, number> = {
  'lun': 1, 'mon': 1,
  'mar': 2, 'tue': 2,
  'mié': 3, 'mie': 3, 'wed': 3,
  'jue': 4, 'thu': 4,
  'vie': 5, 'fri': 5,
  'sáb': 6, 'sab': 6, 'sat': 6,
  'dom': 0, 'sun': 0,
};

type LlmResponseShape = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }>; reasoning_content?: string } }>;
};

function parseLlmText(data: LlmResponseShape): string {
  const msg = data.choices?.[0]?.message;
  const content = msg?.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  if (Array.isArray(content)) {
    const text = content
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .trim();
    if (text) return text;
  }
  // Fallback: DeepSeek reasoning models put JSON in reasoning_content
  if (typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()) {
    const full = msg.reasoning_content;
    const start = full.lastIndexOf('{');
    const end = full.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return full.slice(start, end + 1);
    }
    return full;
  }
  return '';
}

function repairJson(raw: string): string {
  let fixed = raw.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  if (!fixed.trim().startsWith('{')) {
    const start = fixed.indexOf('{');
    const end = fixed.lastIndexOf('}');
    if (start !== -1 && end > start) fixed = fixed.slice(start, end + 1);
  }
  return fixed;
}

function getDayOfWeek(): number {
  const now = new Date();
  const locale = now.toLocaleString('es-EC', { timeZone: 'America/Guayaquil', weekday: 'short' });
  const key = locale.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3);
  return DAY_MAP[key] ?? new Date().getDay();
}

const SYSTEM_PROMPT = `Eres un asistente de productividad. Conviertes mensajes en español sobre el día del usuario en actualizaciones JSON de su horario.

## REGLAS ABSOLUTAS

1. Responde ÚNICA Y EXCLUSIVAMENTE con JSON válido entre llaves {}.
2. TODAS las claves JSON DEBEN ir entre comillas dobles: "startTime", "endTime", etc. NUNCA sin comillas.
3. No escribas markdown, explicaciones, ni texto fuera del JSON.
3. Cada actualización debe tener EXACTAMENTE: "startTime", "endTime", "status", "missedReason".
4. status DEBE ser uno de: "completed", "missed", "canceled".
5. missedReason SOLO se pone si status es "missed". Valores válidos: "videojuegos", "redes_sociales", "ocio_general".
6. Si status NO es "missed", missedReason DEBE ser null (no string vacío, no undefined — exactamente null).

## CÓMO INTERPRETAR EL MENSAJE

Palabras que indican COMPLETED:
"hice", "trabajé", "avancé", "cumplí", "terminé", "bien", "normal", "lo hice", "sí", "hecho", "realicé", "completé"

Palabras que indican MISSED + videojuegos:
"jugué", "jugar", "gaming", "play", "xbox", "playstation", "nintendo", "videojuego"

Palabras que indican MISSED + redes_sociales:
"redes", "instagram", "tiktok", "twitter", "x.com", "facebook", "scroll", "youtube", "whatsapp", "telegram"

Palabras que indican MISSED + ocio_general:
"procrastiné", "no hice nada", "me distraje", "descansé de más", "me dormí", "vi series", "netflix", "película", "no trabajé", "perdí el tiempo"

Palabras que indican CANCELED:
"cancelado", "cancelaron", "no hubo", "emergencia", "imprevisto", "no se pudo", "se suspendió"

## IMPORTANTE

- Si el usuario dice frases como "todo bien", "cumplí con todo", "día normal", "sin novedad" → devuelve {"blocks":[]}
- Si el usuario dice "de 8 a 11 hice tesis" → busca el bloque que empiece a las 08:00 y termine a las 11:00
- Si el usuario usa horas sin formato (ej: "de 8 a 11") → conviértelo a "08:00" y "11:00"
- Solo incluye bloques MENCIONADOS EXPLÍCITAMENTE. No inventes bloques que el usuario no mencionó.

## EJEMPLOS

Ejemplo 1:
Usuario: "De 8 a 11 trabajé en la tesis, de 11 a 11:30 jugué videojuegos, de 11:30 a 1 trabajé"
Respuesta: {"blocks":[{"startTime":"08:00","endTime":"11:00","status":"completed","missedReason":null},{"startTime":"11:00","endTime":"11:30","status":"missed","missedReason":"videojuegos"},{"startTime":"11:30","endTime":"13:00","status":"completed","missedReason":null}]}

Ejemplo 2:
Usuario: "Cancelaron la clase de la tarde"
Respuesta: {"blocks":[{"startTime":"14:00","endTime":"17:00","status":"canceled","missedReason":null}]}

Ejemplo 3:
Usuario: "Hoy todo normal, cumplí"
Respuesta: {"blocks":[]}

Ejemplo 4:
Usuario: "En la mañana bien, pero en la tarde me puse a ver YouTube en vez de trabajar"
Respuesta: {"blocks":[{"startTime":"14:00","endTime":"16:00","status":"missed","missedReason":"redes_sociales"}]}`;

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

  const dayOfWeek = getDayOfWeek();

  const blocks = await prisma.scheduleBlock.findMany({
    where: { userId: session.user.id, dayOfWeek },
    orderBy: { startTime: 'asc' },
  });

  if (blocks.length === 0) {
    return NextResponse.json({ error: 'No hay bloques en tu horario para hoy. Refresca la página.' }, { status: 400 });
  }

  const blocksList = blocks.map(b =>
    `- ${b.startTime.substring(0, 5)} a ${b.endTime.substring(0, 5)}: ${b.label || b.category} (categoría: ${b.category})`
  ).join('\n');

  const today = new Date();
  const dateContext = `\nFECHA ACTUAL: ${today.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.\nHORARIO DE HOY:\n${blocksList}\n\nMENSAJE DEL USUARIO:\n"${message}"`;

  try {
    const llmRes = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.3,
        reasoning: { enabled: false },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: dateContext },
        ],
        max_tokens: 1000,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('LLM HTTP error:', llmRes.status, errText.slice(0, 300));
      return NextResponse.json({ error: `Error del servidor IA (${llmRes.status})` }, { status: 500 });
    }

    const data = (await llmRes.json()) as LlmResponseShape;

    console.log('Full DeepSeek response:', JSON.stringify(data).slice(0, 800));

    if (!data.choices?.[0]) {
      console.error('DeepSeek returned no choices');
      return NextResponse.json({ error: 'La IA no pudo procesar el mensaje. Intenta con otras palabras.' }, { status: 500 });
    }

    const raw = parseLlmText(data);

    if (!raw) {
      console.error('parseLlmText returned empty from:', JSON.stringify(data.choices[0].message).slice(0, 500));
      return NextResponse.json({ error: 'La IA no devolvió respuesta. Intenta con más detalle.' }, { status: 400 });
    }

    console.log('Parsed content:', raw.slice(0, 500));

    let parsed;
    try {
      parsed = parseJsonResponse(raw);
    } catch {
      // DeepSeek sometimes returns JSON with unquoted keys
      try {
        const repaired = repairJson(raw);
        console.log('Repaired JSON:', repaired.slice(0, 300));
        parsed = JSON.parse(repaired);
      } catch {
        return NextResponse.json({ error: 'No se pudo interpretar la respuesta de la IA. Intenta con más detalle.' }, { status: 400 });
      }
    }

    const dateObj = getGuayaquilMidnight(date);
    const results = [];

    for (const update of (parsed as { blocks?: Array<Record<string, unknown>> }).blocks || []) {
      const block = blocks.find(b =>
        b.startTime === update.startTime && b.endTime === update.endTime
      );
      if (!block) {
        console.log('Block not found for:', update.startTime, update.endTime);
        continue;
      }
      if (!['completed', 'missed', 'canceled'].includes(update.status as string)) {
        console.log('Invalid status:', update.status);
        continue;
      }

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
          status: update.status as string,
          missedReason: update.status === 'missed' ? ((update.missedReason as string) || 'ocio_general') : null,
        },
        update: {
          status: update.status as string,
          missedReason: update.status === 'missed' ? ((update.missedReason as string) || 'ocio_general') : null,
        },
      });
      results.push(log);
    }

    return NextResponse.json({
      updated: results.length,
      total: blocks.length,
      message: results.length > 0
        ? `Se actualizaron ${results.length} bloques.`
        : 'No se encontraron bloques para actualizar. ¿Mencionaste horarios específicos? Ej: "de 8 a 11 hice tesis".',
    });
  } catch (err) {
    console.error('AI update unexpected error:', err);
    return NextResponse.json({ error: 'Error inesperado. Intenta de nuevo.' }, { status: 500 });
  }
}