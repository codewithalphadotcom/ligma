/**
 * AI intent classification — labels canvas text content as one of:
 *   action item | decision | open question | reference
 *
 * Backed by Groq's OpenAI-compatible /chat/completions endpoint. Groq is
 * preferred for this hackathon because it returns JSON-mode completions in
 * <300ms, which keeps the 1.5s debounce on the client feeling instant.
 *
 * Set GROQ_API_KEY in apps/server/.env (or your shell). When the key is
 * missing OR the API errors out, we fall back to a deterministic regex
 * classifier so the Task Board still populates in dev/offline mode.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// `llama-3.1-8b-instant` is the smallest/fastest Groq-hosted model and is
// more than sufficient for 4-way classification of short whiteboard text.
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant';

const LABELS = ['action item', 'decision', 'open question', 'reference'] as const;
type Label = typeof LABELS[number];

const SYSTEM_PROMPT = `You classify short whiteboard / sticky-note text into exactly one of these labels:
- "action item": something that needs doing (a task, todo, assignment, follow-up).
- "decision": a choice that has been made or agreed.
- "open question": an unanswered question, uncertainty, or thing to investigate.
- "reference": background info, links, names, definitions — anything informational.

Respond with strict JSON: {"label": "<one of the four labels>", "confidence": <number 0..1>}.
Do not include any other keys, prose, or markdown.`;

function keywordFallback(text: string): { label: Label; confidence: number } {
  const lower = text.toLowerCase();
  if (lower.includes('?') || /\b(how|why|what|when|who|should we|can we)\b/.test(lower)) {
    return { label: 'open question', confidence: 0.6 };
  }
  if (/\b(decided|we will|agreed|going with|confirmed|approved)\b/.test(lower)) {
    return { label: 'decision', confidence: 0.6 };
  }
  if (/\b(todo|fix|assign|implement|build|create|need to|should|must|will)\b/.test(lower)) {
    return { label: 'action item', confidence: 0.6 };
  }
  return { label: 'reference', confidence: 0.5 };
}

function isLabel(value: unknown): value is Label {
  return typeof value === 'string' && (LABELS as readonly string[]).includes(value);
}

export async function classifyIntent(
  text: string,
): Promise<{ label: Label; confidence: number }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return keywordFallback(text);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        // JSON mode forces strict JSON output so we can JSON.parse without
        // having to strip code fences.
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 60,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return keywordFallback(text);

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return keywordFallback(text);

    let parsed: { label?: unknown; confidence?: unknown };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return keywordFallback(text);
    }

    if (!isLabel(parsed.label)) return keywordFallback(text);
    const conf =
      typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
        ? Math.round(parsed.confidence * 100) / 100
        : 0.7;
    return { label: parsed.label, confidence: conf };
  } catch {
    return keywordFallback(text);
  }
}

// ---------------------------------------------------------------------------
// AI Summary Export
// ---------------------------------------------------------------------------

export interface TaskSummaryInput {
  content: string;
  authorName: string;
  status: 'open' | 'done';
  createdAt: number;
}

const SUMMARY_SYSTEM_PROMPT = `You are an assistant that turns a raw list of action items from a collaborative whiteboard into a clean, readable Markdown summary suitable for sharing with a team.

Requirements:
- Output strict Markdown only (no code fences wrapping the whole document).
- Start with a short paragraph (1–3 sentences) that textualizes what the team is working on, based on the items.
- Then a "## Open Action Items" section with bullet points. Each bullet: the task rephrased clearly, with the assignee in italics at the end, e.g. "- Ship the onboarding flow — *Alex*".
- Then a "## Completed" section with the same bullet style for done items (omit this section entirely if there are none).
- Keep wording crisp. Group obvious duplicates. Do not invent items not present in the input.
- No preamble like "Here is your summary". Begin directly with the paragraph.`;

function localFallbackSummary(tasks: TaskSummaryInput[], roomName?: string): string {
  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status === 'done');
  const lines: string[] = [];
  const title = roomName ? `# ${roomName} — Action Summary` : '# Action Summary';
  lines.push(title);
  lines.push('');
  lines.push(
    `This board currently tracks ${tasks.length} action item${tasks.length === 1 ? '' : 's'} (${open.length} open, ${done.length} completed).`,
  );
  lines.push('');
  if (open.length > 0) {
    lines.push('## Open Action Items');
    for (const t of open) {
      const c = t.content.trim().replace(/\s+/g, ' ');
      if (!c) continue;
      lines.push(`- ${c} — *${t.authorName}*`);
    }
    lines.push('');
  }
  if (done.length > 0) {
    lines.push('## Completed');
    for (const t of done) {
      const c = t.content.trim().replace(/\s+/g, ' ');
      if (!c) continue;
      lines.push(`- ${c} — *${t.authorName}*`);
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

export async function summarizeTasks(
  tasks: TaskSummaryInput[],
  roomName?: string,
): Promise<{ markdown: string; source: 'groq' | 'fallback' }> {
  if (tasks.length === 0) {
    const md = roomName
      ? `# ${roomName} — Action Summary\n\nNo action items have been captured yet.\n`
      : `# Action Summary\n\nNo action items have been captured yet.\n`;
    return { markdown: md, source: 'fallback' };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { markdown: localFallbackSummary(tasks, roomName), source: 'fallback' };

  const userPayload = {
    room: roomName ?? null,
    items: tasks.map((t) => ({
      text: t.content,
      author: t.authorName,
      status: t.status,
    })),
  };

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Use a slightly larger model for cleaner prose; falls back to the
        // intent classifier model if that env override isn't set.
        model: process.env.GROQ_SUMMARY_MODEL ?? GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return { markdown: localFallbackSummary(tasks, roomName), source: 'fallback' };

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return { markdown: localFallbackSummary(tasks, roomName), source: 'fallback' };

    // Strip an outer ```markdown ... ``` fence if the model added one.
    const stripped = raw
      .replace(/^```(?:markdown|md)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    // Prepend a title line if the model didn't include one.
    const md = /^#\s/.test(stripped)
      ? stripped
      : `# ${roomName ? `${roomName} — Action Summary` : 'Action Summary'}\n\n${stripped}`;

    return { markdown: md + (md.endsWith('\n') ? '' : '\n'), source: 'groq' };
  } catch {
    return { markdown: localFallbackSummary(tasks, roomName), source: 'fallback' };
  }
}
