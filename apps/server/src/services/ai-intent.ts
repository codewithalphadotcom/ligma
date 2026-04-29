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

const SUMMARY_SYSTEM_PROMPT = `You are a senior project manager writing a polished, share-ready meeting summary for a collaborative whiteboard. Your audience is a busy team that needs to immediately understand the state of the work without reading the raw items themselves.

You will receive a JSON payload with a \`room\` (the human-friendly room/project name) and an \`items\` array, where each item has \`text\`, \`author\`, and \`status\` ("open" or "done").

OUTPUT FORMAT — follow EXACTLY:
1. The very first line MUST be a single H1 title in this exact form: \`# <Room Name> — Action Summary\`. Use the value of \`room\` from the input verbatim. If \`room\` is null/empty, use \`# Action Summary\`. NEVER put a UUID, room id, or random hex string in the title.
2. Blank line, then a 2–4 sentence executive paragraph that synthesizes WHAT the team is working on and the overall state of progress. Infer the theme from the items themselves (e.g. "preparing a product demo", "shipping onboarding", "fixing critical bugs"). Be specific and confident — do not say "the team has some items".
3. Blank line, then \`## Open Action Items\` containing a Markdown bullet list — one bullet per open item. Each bullet:
   - Rewrite the raw text into a clear, imperative task ("Fix the login bug before demo", not "login is broken!!").
   - Fix obvious typos and capitalization. Strip filler/profanity. Keep it professional.
   - End each bullet with \` — *<Author Name>*\` (em dash + italic author).
   - Example: \`- Fix the login bug before the demo — *Minion*\`
4. If at least one item has status "done": blank line, then \`## Completed\` with the same bullet style for those items. If there are NO done items, OMIT this section entirely — do not write an empty heading.

HARD RULES:
- Output strict Markdown only. NO code fences, NO HTML, NO JSON, NO commentary, NO preamble like "Here is your summary".
- NEVER include the room id / UUID anywhere in the document.
- NEVER invent action items that are not in the input.
- Merge obvious duplicates (same author + same intent) into a single bullet.
- Preserve every distinct action item — do not drop items just because they are short or informal.
- Even if there is only ONE item, still produce the full structure (title, paragraph, Open Action Items section).
- Keep the tone crisp, professional, and confident. No hedging ("maybe", "it seems"), no emojis, no exclamation marks.

Begin your response with the \`#\` title line. Nothing before it.`;

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

    // Defensive: enforce the correct H1 title regardless of what the model
    // produced. We've seen Groq occasionally echo the room id (a UUID) in the
    // title even when the system prompt forbids it, so we always rewrite the
    // first heading line with the canonical title.
    const canonicalTitle = `# ${roomName ? `${roomName} — Action Summary` : 'Action Summary'}`;
    let body = stripped;
    if (/^#\s+/.test(body)) {
      // Replace the first H1 line with our canonical title.
      body = body.replace(/^#\s+.*\n?/, '');
    }
    body = body.replace(/^\s+/, '');
    const md = `${canonicalTitle}\n\n${body}`;

    return { markdown: md + (md.endsWith('\n') ? '' : '\n'), source: 'groq' };
  } catch {
    return { markdown: localFallbackSummary(tasks, roomName), source: 'fallback' };
  }
}
