import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildSystemPrompt,
  DEFAULT_HABITS,
  type CheckInResult,
  type HabitCategory,
  type HabitScores,
} from '@/lib/accountability';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type LlmResponseShape = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> } }>;
  output_text?: string;
};

function parseLlmText(data: LlmResponseShape): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .trim();
    if (text) return text;
  }
  throw new Error('No content returned by LLM');
}

function parseJsonResponse(rawContent: string): unknown {
  const trimmed = rawContent.trim();
  if (!trimmed) throw new Error('LLM returned empty response');
  try { return JSON.parse(trimmed); } catch { /* continue */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM returned non-JSON content');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
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

function validateHabitScores(raw: unknown, categories: HabitCategory[]): HabitScores {
  const result: HabitScores = {};
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  for (const cat of categories) {
    const entry = obj[cat.key];
    if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      const score = typeof e.score === 'number' && Number.isFinite(e.score)
        ? Math.min(100, Math.max(0, Math.round(e.score as number)))
        : null;
      const notes = typeof e.notes === 'string' ? e.notes.trim() : '';
      result[cat.key] = { score, notes };
    } else {
      result[cat.key] = { score: null, notes: '' };
    }
  }
  return result;
}

async function callAccountabilityLlm(
  userText: string,
  categories: HabitCategory[],
  previousFeedback?: string
): Promise<CheckInResult> {
  const endpoint = process.env.BREAKDOWN_LLM_URL;
  const apiKey = process.env.BREAKDOWN_LLM_API_KEY;
  const model = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';

  if (!endpoint || !apiKey) {
    throw new Error('Accountability AI not configured. Set BREAKDOWN_LLM_URL and BREAKDOWN_LLM_API_KEY.');
  }

  const systemPrompt = buildSystemPrompt(categories);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (previousFeedback) {
    messages.push({ role: 'assistant', content: previousFeedback });
  }

  messages.push({ role: 'user', content: userText });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as LlmResponseShape;
  const parsed = parseJsonResponse(parseLlmText(data)) as Record<string, unknown>;

  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const habits = validateHabitScores(parsed.habits, categories);

  return { feedback, summary, habits };
}

async function getUserDate(userId: string): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = user?.timezone || 'America/Guayaquil';
  const now = new Date();
  const dateInTz = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = dateInTz.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const rawText = typeof body.text === 'string' ? body.text.trim() : '';

    if (!rawText) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const categories = await ensureUserHabits(userId);

    const today = await getUserDate(userId);

    const existing = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const existingScores = (existing?.habitScores as HabitScores) || {};
    const previousFeedback = existing?.feedback || undefined;

    const result = await callAccountabilityLlm(rawText, categories, previousFeedback);

    if (existing) {
      const mergedHabits: HabitScores = { ...existingScores };
      for (const cat of categories) {
        const newScore = result.habits[cat.key];
        if (newScore && newScore.score !== null) {
          mergedHabits[cat.key] = newScore;
        }
      }

      const updated = await prisma.dailyCheckIn.update({
        where: { id: existing.id },
        data: {
          rawText: existing.rawText + '\n\n---\n\n' + rawText,
          habitScores: mergedHabits,
          feedback: result.feedback,
          summary: result.summary,
        },
      });

      return NextResponse.json({
        id: updated.id,
        feedback: result.feedback,
        summary: result.summary,
        habitScores: mergedHabits,
        isUpdate: true,
      });
    }

    const created = await prisma.dailyCheckIn.create({
      data: {
        userId,
        date: today,
        rawText,
        habitScores: result.habits,
        feedback: result.feedback,
        summary: result.summary,
      },
    });

    return NextResponse.json({
      id: created.id,
      feedback: result.feedback,
      summary: result.summary,
      habitScores: result.habits,
      isUpdate: false,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  try {
    if (dateParam) {
      const date = new Date(dateParam + 'T00:00:00Z');
      const entry = await prisma.dailyCheckIn.findUnique({
        where: { userId_date: { userId, date } },
      });
      return NextResponse.json(entry ? { ...entry, habitScores: entry.habitScores as HabitScores } : null);
    }

    if (fromParam || toParam) {
      const from = fromParam ? new Date(fromParam + 'T00:00:00Z') : new Date(0);
      const to = toParam ? new Date(toParam + 'T23:59:59Z') : new Date();
      const entries = await prisma.dailyCheckIn.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: 'desc' },
      });
      return NextResponse.json(entries.map((e) => ({ ...e, date: e.date.toISOString(), habitScores: e.habitScores as HabitScores })));
    }

    const today = await getUserDate(userId);
    const entry = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    return NextResponse.json(entry ? { ...entry, date: entry.date.toISOString(), habitScores: entry.habitScores as HabitScores } : null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch check-ins';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
