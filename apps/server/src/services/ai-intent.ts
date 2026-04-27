const HF_API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';
const LABELS = ['action item', 'decision', 'open question', 'reference'];

function keywordFallback(text: string): { label: string; confidence: number } {
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

export async function classifyIntent(text: string): Promise<{ label: string; confidence: number }> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (!hfToken) return keywordFallback(text);

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text, parameters: { candidate_labels: LABELS } }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return keywordFallback(text);

    const data = await response.json() as { labels: string[]; scores: number[] };
    return { label: data.labels[0], confidence: Math.round(data.scores[0] * 100) / 100 };
  } catch {
    return keywordFallback(text);
  }
}
