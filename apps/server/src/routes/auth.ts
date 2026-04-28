import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { users } from '@/db/schema.js';
import {
  canResend,
  issueOtp,
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  normalizeEmail,
  verifyOtp,
} from '@/services/otp.js';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '@/services/email.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

function colorFromEmail(email: string): string {
  const hash = [...email].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length]!;
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

const googleUpsertSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  googleId: z.string().min(1),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(6),
});

const router = Router();

/**
 * POST /auth/signup
 *
 * Creates an unverified user, issues an OTP, and emails it. Does NOT mint a
 * JWT — the client must call /auth/verify-email first. Re-signing up over an
 * existing unverified account is allowed: it refreshes the password and
 * re-sends a fresh code (legitimate when a user typo'd their email and
 * abandoned the prior attempt). Verified accounts return 409.
 */
router.post('/signup', asyncHandler(async (req, res) => {
  const body = signupSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const name = body.data.name.trim();
  const email = normalizeEmail(body.data.email);
  const { password } = body.data;
  const color = colorFromEmail(email);
  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing && existing.emailVerified) {
    return res.status(409).json({ error: 'email already registered' });
  }

  if (existing && !existing.emailVerified) {
    if (!(await canResend(email, 'verify_email'))) {
      return res.status(429).json({
        error: 'please wait before requesting another code',
        retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      });
    }
    await db
      .update(users)
      .set({ name, passwordHash })
      .where(eq(users.id, existing.id));
  } else {
    try {
      await db
        .insert(users)
        .values({ name, email, passwordHash, color, emailVerified: false });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return res.status(409).json({ error: 'email already registered' });
      }
      throw err;
    }
  }

  const code = await issueOtp(email, 'verify_email');
  try {
    await sendVerificationEmail({
      to: email,
      name,
      code,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (err) {
    console.error('[auth/signup] failed to send verification email:', err);
    return res.status(502).json({ error: 'unable to send verification email' });
  }

  return res.status(202).json({
    requiresVerification: true,
    email,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  });
}));

/**
 * POST /auth/verify-email
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  const body = verifyEmailSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const email = normalizeEmail(body.data.email);
  const result = await verifyOtp(email, 'verify_email', body.data.code);
  if (!result.ok) {
    const status = result.reason === 'too_many_attempts' ? 429 : 400;
    return res.status(status).json({ error: result.reason });
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      color: users.color,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return res.status(404).json({ error: 'user not found' });

  const wasUnverified = !user.emailVerified;
  if (wasUnverified) {
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
    // Welcome email: fire-and-forget, send only on first verification.
    sendWelcomeEmail({ to: user.email, name: user.name }).catch((err) => {
      console.error('[auth/verify-email] welcome email failed:', err);
    });
  }

  const token = makeToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    color: user.color,
  });
  return res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, color: user.color },
  });
}));

/**
 * POST /auth/resend-verification
 *
 * Always returns 200 (modulo cooldown) to avoid leaking which emails are
 * registered.
 */
router.post('/resend-verification', asyncHandler(async (req, res) => {
  const body = resendSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const email = normalizeEmail(body.data.email);
  if (!(await canResend(email, 'verify_email'))) {
    return res.status(429).json({
      error: 'please wait before requesting another code',
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user && !user.emailVerified) {
    const code = await issueOtp(email, 'verify_email');
    try {
      await sendVerificationEmail({
        to: email,
        name: user.name,
        code,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      });
    } catch (err) {
      console.error('[auth/resend-verification] send failed:', err);
      return res.status(502).json({ error: 'unable to send verification email' });
    }
  }
  return res.status(200).json({ ok: true, expiresInMinutes: OTP_EXPIRY_MINUTES });
}));

/**
 * POST /auth/forgot-password
 *
 * Always responds 200 to prevent enumeration. OTP is only emailed when the
 * account exists AND has a password set (Google-only accounts have nothing
 * to reset).
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const body = forgotSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const email = normalizeEmail(body.data.email);

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user && user.passwordHash) {
    if (!(await canResend(email, 'password_reset'))) {
      return res.status(429).json({
        error: 'please wait before requesting another code',
        retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      });
    }
    const code = await issueOtp(email, 'password_reset');
    try {
      await sendPasswordResetEmail({
        to: email,
        code,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      });
    } catch (err) {
      console.error('[auth/forgot-password] send failed:', err);
      return res.status(502).json({ error: 'unable to send reset email' });
    }
  }
  return res.status(200).json({ ok: true, expiresInMinutes: OTP_EXPIRY_MINUTES });
}));

/**
 * POST /auth/reset-password
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const body = resetSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const email = normalizeEmail(body.data.email);
  const result = await verifyOtp(email, 'password_reset', body.data.code);
  if (!result.ok) {
    const status = result.reason === 'too_many_attempts' ? 429 : 400;
    return res.status(status).json({ error: result.reason });
  }

  const passwordHash = await bcrypt.hash(body.data.newPassword, 10);
  const [user] = await db
    .update(users)
    .set({ passwordHash, emailVerified: true })
    .where(eq(users.email, email))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      color: users.color,
    });
  if (!user) return res.status(404).json({ error: 'user not found' });

  const token = makeToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    color: user.color,
  });
  return res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, color: user.color },
  });
}));

/**
 * POST /auth/login
 *
 * Returns 403 `email_not_verified` if the account exists but hasn't been
 * verified yet — the UI uses that signal to bounce into /verify-email.
 */
router.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const email = normalizeEmail(body.data.email);
  const { password } = body.data;
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      color: users.color,
      passwordHash: users.passwordHash,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (!user.emailVerified) {
    return res.status(403).json({ error: 'email_not_verified', email });
  }

  const token = makeToken({ userId: user.id, name: user.name, email, color: user.color });
  return res.status(200).json({ token, user: { id: user.id, name: user.name, email, color: user.color } });
}));

/**
 * POST /auth/google-upsert
 *
 * Authenticated by `AUTH_SHARED_SECRET`. On first-ever insert we fire a
 * welcome email; existing rows just get their googleId/name refreshed.
 * Google accounts are auto-marked email_verified.
 */
router.post('/google-upsert', asyncHandler(async (req, res) => {
  const sharedSecret = process.env.AUTH_SHARED_SECRET;
  if (!sharedSecret) {
    return res.status(503).json({ error: 'Google auth disabled: AUTH_SHARED_SECRET not configured' });
  }
  const presented = req.headers['x-auth-shared-secret'];
  if (presented !== sharedSecret) {
    return res.status(401).json({ error: 'invalid shared secret' });
  }

  const body = googleUpsertSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const email = normalizeEmail(body.data.email);
  const name = body.data.name.trim();
  const { googleId } = body.data;
  const color = colorFromEmail(email);

  // Detect first-time creation so we only send the welcome email once.
  const [pre] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const isNew = !pre;

  const [row] = await db
    .insert(users)
    .values({ name, email, color, googleId, emailVerified: true })
    .onConflictDoUpdate({
      target: users.email,
      set: { googleId, name, emailVerified: true },
    })
    .returning({ id: users.id, name: users.name, color: users.color });
  if (!row) throw new Error('upsert returned no row');

  if (isNew) {
    sendWelcomeEmail({ to: email, name: row.name }).catch((err) => {
      console.error('[auth/google-upsert] welcome email failed:', err);
    });
  }

  const token = makeToken({ userId: row.id, name: row.name, email, color: row.color });
  return res.status(200).json({
    token,
    user: { id: row.id, name: row.name, email, color: row.color },
  });
}));

export default router;
