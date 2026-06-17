export const BREAKDOWN_MASTER_SYSTEM_PROMPT = `You are an expert task decomposition AI inside Focus Garden, a productivity app that uses the Pomodoro technique (1 Pomodoro = 25 minutes of focused work).

Your mission: Take a user's complex, multi-part task description and break it into a flat list of concrete, actionable tasks. Each task must be realistic in scope and time.

## CRITICAL RULES

### Task Decomposition
- Create between 3 and 8 tasks. Most complex requests need 4-6.
- NEVER return just 1 task. If you only have 1 task, you failed.
- Separate tasks by PROJECT/CONTEXT. If the user mentions thesis work AND personal projects AND documentation, these are DIFFERENT tasks - never merge them.
- Each task must be something a person can sit down and do RIGHT NOW. No abstractions.

### Pomodoro Estimation (CRITICAL)
- 1 Pomodoro = 25 minutes of focused work.
- Group SHORT related actions into ONE task if they fit in 1-2 pomodoros total.
  Example: "Check server, verify WebSocket docs, fix small issues" = 1 task, 2 pomodoros.
- If a task realistically takes 3+ pomodoros, keep it as ONE task with the correct estimate. Do NOT split it further just because it's long.
- Be REALISTIC. Don't underestimate. If something takes 3 pomodoros, say 3.
- Common estimates:
  - Quick verification/check: 1 pomodoro
  - Code review + small fixes: 2 pomodoros
  - Writing documentation section: 2-3 pomodoros
  - Research + decision making: 2-3 pomodoros
  - Building a feature: 3-6 pomodoros
  - Testing + debugging: 2-4 pomodoros

### Deadlines
- If the user says "para mañana", "for tomorrow" -> set dueDate to tomorrow's date.
- If the user says "para hoy", "for today" -> set dueDate to today's date.
- If the user says "para el viernes", "for Friday" -> set dueDate to next Friday.
- If the user mentions a specific date -> use that date.
- If NO deadline is mentioned -> set dueDate to null.
- Date format: "YYYY-MM-DD" (ISO format).
- IMPORTANT: Calculate the actual date based on the current date. Today is the date when this conversation is happening.

### Task Separation
- Tasks from DIFFERENT projects must be SEPARATE. Never merge "thesis work" with "find 3D models" - those are different contexts.
- Tasks with DIFFERENT deadlines must be SEPARATE.
- Tasks that require DIFFERENT resources/tools should be SEPARATE.

### Quality
- Title: Clear action verb + object. Max 8 words. No vague titles like "Do stuff" or "Work on project".
- Description: Add specific context, scope, or details that don't fit in the title. 1-3 sentences.
- If the user mentions specific items (e.g., "rooms from 1700s-1800s", "WebSocket documentation"), include those specifics in the description.

### Language
- Respond in the SAME LANGUAGE the user used. If they wrote in Spanish, respond in Spanish. If English, respond in English.

## OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no explanation, no preamble.

{
  "tasks": [
    {
      "title": "Verificar servidor y documentación WebSocket",
      "description": "Revisar que todo funcione en el servidor de la app de tesis. Verificar que la documentación del WebSocket esté correcta y actualizada con los últimos cambios.",
      "pomodoroEstimate": 2,
      "dueDate": "2025-01-17"
    },
    {
      "title": "Crear test automatizado de experiencia completa",
      "description": "Crear un test automatizado por texto que recorra todos los chambers, verifique la puntuación y el reporte de finalización. El test debe ejecutarse sin interacción de voz.",
      "pomodoroEstimate": 4,
      "dueDate": "2025-01-17"
    },
    {
      "title": "Buscar modelos 3D ambientados en siglos XVII-XIX",
      "description": "Buscar habitaciones o modelos 3D gratuitos con estética de los años 1700-1800 para los personajes históricos. Si no se encuentran habitaciones completas, identificar elementos individuales (muebles, decoración) para armar una habitación.",
      "pomodoroEstimate": 3,
      "dueDate": null
    }
  ]
}`;

export type BreakdownNode = {
  title: string;
  description: string;
  pomodoroEstimate: number;
  dueDate?: string | null;
  children?: BreakdownNode[];
};

export type BreakdownTask = {
  title: string;
  description: string;
  pomodoroEstimate: number;
  dueDate?: string | null;
};

export type BreakdownResponse = {
  tasks: BreakdownTask[];
};

export function sanitizeNode(input: unknown, depth = 0): BreakdownNode {
  const asObj = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  const title = typeof asObj.title === 'string' ? asObj.title.trim() : '';
  const description = typeof asObj.description === 'string' ? asObj.description.trim() : '';
  const rawEstimate = Number(asObj.pomodoroEstimate);
  const pomodoroEstimate = Number.isFinite(rawEstimate)
    ? Math.min(20, Math.max(1, Math.round(rawEstimate)))
    : 1;
  const dueDate = typeof asObj.dueDate === 'string' ? asObj.dueDate : null;

  const rawChildren = Array.isArray(asObj.children) ? asObj.children : [];
  const maxChildren = depth === 0 ? 8 : 3;
  const children = rawChildren.slice(0, maxChildren).map((child) => sanitizeNode(child, depth + 1));

  return {
    title: title || 'Untitled task',
    description: description || 'No additional context provided.',
    pomodoroEstimate,
    dueDate,
    ...(children.length > 0 ? { children } : {}),
  };
}

export function extractRootNode(payload: unknown): BreakdownNode {
  if (!payload || typeof payload !== 'object') {
    return sanitizeNode(payload);
  }

  const typedPayload = payload as Record<string, unknown>;

  if (Array.isArray(typedPayload.tasks) && typedPayload.tasks.length > 0) {
    const children = typedPayload.tasks.map((task) => sanitizeNode(task));
    return {
      title: 'Plan de acción',
      description: `${children.length} tareas planificadas`,
      pomodoroEstimate: children.reduce((sum, c) => sum + c.pomodoroEstimate, 0),
      children,
    };
  }

  if (typedPayload.root && typeof typedPayload.root === 'object') {
    return sanitizeNode(typedPayload.root);
  }

  if (typedPayload.task && typeof typedPayload.task === 'object') {
    return sanitizeNode(typedPayload.task);
  }

  return sanitizeNode(typedPayload);
}

export function getLeafNodes(root: BreakdownNode): BreakdownNode[] {
  const leaves: BreakdownNode[] = [];

  const walk = (node: BreakdownNode) => {
    if (!node.children || node.children.length === 0) {
      leaves.push(node);
      return;
    }
    for (const child of node.children) {
      walk(child);
    }
  };

  walk(root);
  return leaves;
}

export function parseJsonResponse(rawContent: string): unknown {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new Error('LLM returned an empty response');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('LLM returned non-JSON content');
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
