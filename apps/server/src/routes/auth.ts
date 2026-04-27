import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '@/db/client.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6'];

function colorFromEmail(email: string): string {
  const hash = [...email].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function makeToken(payload: { userId: string; name: string; email: string; color: string }) {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: '7d' });
}

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const asyncHandler = (fn: AsyncFn): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const router = Router();

router.post('/signup', asyncHandler(async (req, res) => {
  const body = signupSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { name, email, password } = body.data;
  const color = colorFromEmail(email);
  const password_hash = await bcrypt.hash(password, 10);

  let row: { id: string; color: string };
  try {
    const result = await query(
      'INSERT INTO users (name, email, password_hash, color) VALUES ($1, $2, $3, $4) RETURNING id, color',
      [name, email, password_hash, color],
    );
    row = result.rows[0];
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'email already registered' });
    }
    throw err;
  }

  const token = makeToken({ userId: row.id, name, email, color: row.color });
  return res.status(201).json({ token, user: { id: row.id, name, email, color: row.color } });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { email, password } = body.data;
  const result = await query('SELECT id, name, color, password_hash FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = makeToken({ userId: user.id, name: user.name, email, color: user.color });
  return res.status(200).json({ token, user: { id: user.id, name: user.name, email, color: user.color } });
}));

export default router;
