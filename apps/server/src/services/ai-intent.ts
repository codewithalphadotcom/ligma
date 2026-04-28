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
