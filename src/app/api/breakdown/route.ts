import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  BREAKDOWN_MASTER_SYSTEM_PROMPT,
  extractRootNode,
  parseJsonResponse,
  type BreakdownNode,
} from '@/lib/breakdown';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type LlmResponseShape = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> } }>;
  output_text?: string;
};

function parseLlmText(data: LlmResponseShape): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  throw new Error('No content returned by LLM');
}

async function requestBreakdownFromLlm(messages: ChatMessage[], modelOverride?: string) {
  const endpoint = process.env.BREAKDOWN_LLM_URL;
  const apiKey = process.env.BREAKDOWN_LLM_API_KEY;
  const defaultModel = process.env.BREAKDOWN_LLM_MODEL || 'deepseek-chat';
  const model = modelOverride || defaultModel;

  if (!endpoint || !apiKey) {
    throw new Error('Breakdown AI is not configured. Set BREAKDOWN_LLM_URL and BREAKDOWN_LLM_API_KEY.');
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dateContext = `\n\nCURRENT DATE CONTEXT: Today is ${dayName}, ${todayStr}. Use this to calculate relative deadlines like "tomorrow", "next Friday", etc.`;

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
      messages: [
        { role: 'system', content: BREAKDOWN_MASTER_SYSTEM_PROMPT + dateContext },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as LlmResponseShape;
  const parsed = parseJsonResponse(parseLlmText(data));
  return extractRootNode(parsed);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const history = Array.isArray(body.history) ? (body.history as ChatMessage[]) : [];
    const currentTree = body.currentTree as BreakdownNode | undefined;
    const modelOverride = typeof body.model === 'string' ? body.model.trim() : undefined;

    if (!rawPrompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const safeHistory = history
      .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.content === 'string')
      .slice(-8)
      .map((entry) => ({ role: entry.role, content: entry.content.trim() }))
      .filter((entry) => entry.content.length > 0);

    const llmMessages: ChatMessage[] = [...safeHistory];

    if (currentTree) {
      llmMessages.push({
        role: 'assistant',
        content: JSON.stringify({ root: currentTree }),
      });
    }

    llmMessages.push({ role: 'user', content: rawPrompt });

    const rootNode = await requestBreakdownFromLlm(llmMessages, modelOverride);

    const breakdownSession = await prisma.breakdownSession.create({
      data: {
        userId,
        rawInput: rawPrompt,
        structuredOutput: rootNode,
        status: 'draft',
      },
    });

    return NextResponse.json({
      sessionId: breakdownSession.id,
      tree: rootNode,
      createdAt: breakdownSession.createdAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate breakdown';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
