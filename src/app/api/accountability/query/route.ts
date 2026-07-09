import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildQuerySystemPrompt,
  ACCOUNTABILITY_RESPONSE_PROMPT,
  DEFAULT_HABITS,
  type HabitCategory,
  type HabitScores,
} from '@/lib/accountability';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type LlmResponseShape = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> } }>;
  output_text?: string;
};

type QueryParams = {
  queryType: 'overview' | 'habit_trend' | 'comparison' | 'best_worst';
  params: {
    timeRange?: string;
    timeRange1?: string;
    timeRange2?: string;
    habit?: string | null;
  };
  interpretation: string;
};

function parseLlmText(data: LlmResponseShape): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    return content
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .trim();
  }
  throw new Error('No content returned by LLM');
}

function parseJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty response');
  try { return JSON.parse(trimmed); } catch { /* continue */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Non-JSON response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function timeRangeToDate(range: string): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);

  switch (range) {
    case 'today': {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case 'week': {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case 'month': {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case 'year': {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    default: {
      const from = new Date(0);
      return { from, to };
    }
  }
}

function formatQueryResults(
  queryParams: QueryParams,
  entries: Array<{ date: Date; habitScores: HabitScores; summary: string }>,
  categories: HabitCategory[]
): string {
  if (entries.length === 0) return 'No hay datos para el período consultado.';

  const parts: string[] = [];

  const firstDate = entries[0]?.date instanceof Date ? entries[0].date.toISOString().split('T')[0] : '?';
  const lastDate = entries[entries.length - 1]?.date instanceof Date ? entries[entries.length - 1].date.toISOString().split('T')[0] : '?';
  parts.push(`Período: ${entries.length} días con datos (${lastDate} a ${firstDate})\n`);

  for (const cat of categories) {
    const scores = entries
      .map((e) => {
        const h = (e.habitScores as HabitScores)[cat.key];
        return h?.score;
      })
      .filter((s): s is number => s !== null && s !== undefined);

    if (scores.length === 0) {
      parts.push(`${cat.emoji} ${cat.name}: Sin datos`);
      continue;
    }

    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const latest = scores[scores.length - 1];
    const trend = scores.length >= 2
      ? (scores[scores.length - 1] > scores[0] ? 'mejorando' : scores[scores.length - 1] < scores[0] ? 'empeorando' : 'estable')
      : 'sin tendencia';

    parts.push(`${cat.emoji} ${cat.name}: Promedio ${avg}%, Último ${latest}%, Tendencia: ${trend}`);
  }

  parts.push('\nResúmenes diarios:');
  entries.forEach((e) => {
    const d = e.date instanceof Date ? e.date.toISOString().split('T')[0] : String(e.date);
    parts.push(`- ${d}: ${e.summary}`);
  });

  return parts.join('\n');
}

async function ensureUserHabits(userId: string): Promise<HabitCategory[]> {
  const existing = await prisma.accountabilityHabit.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
  });

  if (existing.length > 0) {
    return existing.map((h) => ({
      key: h.key,
      name: h.name,
      emoji: h.emoji,
      description: h.description,
      isDefault: h.isDefault,
    }));
  }

  const created = await Promise.all(
    DEFAULT_HABITS.map((h, i) =>
      prisma.accountabilityHabit.create({
        data: {
          userId,
          key: h.key,
          name: h.name,
          emoji: h.emoji,
          description: h.description,
          isDefault: true,
          sortOrder: i,
        },
      })
    )
  );

  return created.map((h) => ({
    key: h.key,
    name: h.name,
    emoji: h.emoji,
    description: h.description,
    isDefault: h.isDefault,
  }));
}

async function callLlm(messages: ChatMessage[]): Promise<string> {
  const endpoint = process.env.BREAKDOWN_LLM_URL;
  const apiKey = process.env.BREAKDOWN_LLM_API_KEY;
  const model = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';

  if (!endpoint || !apiKey) {
    throw new Error('LLM not configured.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as LlmResponseShape;
  return parseLlmText(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const question = typeof body.question === 'string' ? body.question.trim() : '';

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const categories = await ensureUserHabits(userId);

    const querySystemPrompt = buildQuerySystemPrompt(categories);

    const queryMessages: ChatMessage[] = [
      { role: 'system', content: querySystemPrompt },
      { role: 'user', content: question },
    ];

    const queryRaw = await callLlm(queryMessages);
    const queryParams = parseJson(queryRaw) as QueryParams;

    let dateRange: { from: Date; to: Date };

    if (queryParams.queryType === 'comparison' && queryParams.params.timeRange1 && queryParams.params.timeRange2) {
      dateRange = timeRangeToDate(queryParams.params.timeRange1);
    } else {
      dateRange = timeRangeToDate(queryParams.params.timeRange || 'week');
    }

    const entries = await prisma.dailyCheckIn.findMany({
      where: {
        userId,
        date: { gte: dateRange.from, lte: dateRange.to },
      },
      orderBy: { date: 'asc' },
      select: { date: true, habitScores: true, summary: true },
    });

    const formattedResults = formatQueryResults(
      queryParams,
      entries as Array<{ date: Date; habitScores: HabitScores; summary: string }>,
      categories
    );

    const responsePrompt = ACCOUNTABILITY_RESPONSE_PROMPT
      .replace('{{QUERY_RESULTS}}', formattedResults)
      .replace('{{USER_QUESTION}}', question);

    const responseMessages: ChatMessage[] = [
      { role: 'user', content: responsePrompt },
    ];

    const endpoint = process.env.BREAKDOWN_LLM_URL;
    const apiKey = process.env.BREAKDOWN_LLM_API_KEY;
    const model = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';

    if (!endpoint || !apiKey) {
      return NextResponse.json({ error: 'LLM not configured' }, { status: 500 });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: responseMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Response LLM failed (${response.status}): ${errorText}`);
    }

    const responseData = (await response.json()) as LlmResponseShape;
    const answer = parseLlmText(responseData);

    return NextResponse.json({
      answer,
      queryInterpretation: queryParams.interpretation,
      dataPoints: entries.length,
      dateRange: {
        from: dateRange.from.toISOString().split('T')[0],
        to: dateRange.to.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process query';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
