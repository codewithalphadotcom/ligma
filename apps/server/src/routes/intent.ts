import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { classifyIntent } from '@/services/ai-intent.js';
import type { AuthPayload } from '@/middleware/auth.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

// Soft auth: parse the JWT if present so signed-in users get their generous
// per-user quota, but DO NOT reject the request when it's missing. The demo
// room (`/room/demo`) is publicly accessible to guests, and the AI intent
// pipeline is part of the canvas UX — gating it behind auth would silently
// disable classification + auto task creation for everyone visiting demo
// without an account, which is the whole point of the demo room.
function softAuth(req: Request, _res: Response, next: () => void) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET as string) as AuthPayload;
    } catch {
      // Bad token — treat as guest rather than 401-ing the request, since
      // the route itself does not require auth.
    }
  }
  next();
}

router.use(softAuth);

/** Hard cap on input length. Sticky notes / text blocks should never exceed
 * this in real usage; longer payloads are almost certainly abuse or copy-
 * paste mistakes. Also keeps Groq token spend bounded. */
const MAX_INPUT_CHARS = 2000;

// Token-bucket rate limiter, keyed by userId for signed-in callers and by
// remote IP for guests. Signed-in users get the generous per-user cap;
// guests share a tighter cap per IP to keep our Groq spend bounded if the
// public demo room sees abuse. Both windows are 60s.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_USER = 30;
const RATE_MAX_GUEST = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allow(key: string, max: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

router.post('/', async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  // Guests are bucketed by remote IP. `req.ip` respects `trust proxy` when
  // configured; otherwise it falls back to the direct socket address.
  const rateKey = userId ? `u:${userId}` : `ip:${req.ip ?? 'unknown'}`;
  const rateMax = userId ? RATE_MAX_USER : RATE_MAX_GUEST;

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

  if (!allow(rateKey, rateMax)) {
    res.status(429).json({ error: 'rate limit exceeded', retryAfterMs: RATE_WINDOW_MS });
    return;
  }

  const result = await classifyIntent(trimmed);
  res.json(result);
});

export default router;
