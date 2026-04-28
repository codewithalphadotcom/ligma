import { Router, Request, Response } from 'express';
import { classifyIntent } from '@/services/ai-intent.js';
import auth from '@/middleware/auth.js';

const router = Router();

// Auth-gate: classification calls Groq, so we require a verified user to
// prevent anonymous abuse of our API quota.
router.use(auth);

/** Hard cap on input length. Sticky notes / text blocks should never exceed
 * this in real usage; longer payloads are almost certainly abuse or copy-
 * paste mistakes. Also keeps Groq token spend bounded. */
const MAX_INPUT_CHARS = 2000;

// Per-user in-process rate limiter (token bucket). 30 classifications per
// 60s window is far above the legitimate ceiling (debounce is 1.5s/node)
// but blocks runaway loops or compromised clients.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allow(userId: string): boolean {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || b.resetAt < now) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count += 1;
  return true;
}

router.post('/', async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const { text } = req.body as { text?: unknown };
  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const trimmed = text.trim();
  if (trimmed.length > MAX_INPUT_CHARS) {
    res.status(413).json({ error: 'text too long', max: MAX_INPUT_CHARS });
    return;
  }

  if (!allow(userId)) {
    res.status(429).json({ error: 'rate limit exceeded', retryAfterMs: RATE_WINDOW_MS });
    return;
  }

  const result = await classifyIntent(trimmed);
  res.json(result);
});

export default router;
