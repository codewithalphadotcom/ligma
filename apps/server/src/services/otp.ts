import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { emailOtps } from '@/db/schema.js';

/**
 * OTP lifecycle helpers. Codes are 6-digit numeric, generated with Node's
 * crypto RNG, bcrypt-hashed at rest, expire after 10 minutes, and allow at
 * most 5 failed verification attempts. Sending a new code invalidates any
 * unused predecessors for the same (email, purpose) tuple.
 */

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export type OtpPurpose = 'verify_email' | 'password_reset';

/** Cryptographically-strong 6-digit numeric code (000000–999999). */
export function generateOtpCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Lower-cased + trimmed canonical form so lookups match insertions. */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

/**
 * Persist a fresh OTP for the given email/purpose, invalidating any prior
 * unused codes. Returns the plaintext code (caller is responsible for
 * delivering it via email).
 */
export async function issueOtp(emailRaw: string, purpose: OtpPurpose): Promise<string> {
    const email = normalizeEmail(emailRaw);
    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

    await db.transaction(async (tx) => {
        // Burn any pending codes — a user requesting a fresh code consents
        // to invalidating the previous one.
        await tx
            .update(emailOtps)
            .set({ used: true })
            .where(
                and(
                    eq(emailOtps.email, email),
                    eq(emailOtps.purpose, purpose),
                    eq(emailOtps.used, false),
                ),
            );

        await tx.insert(emailOtps).values({ email, codeHash, purpose, expiresAt });
    });

    return code;
}

/** Returns the most recent OTP row for resend-cooldown enforcement. */
export async function latestOtpFor(emailRaw: string, purpose: OtpPurpose) {
    const email = normalizeEmail(emailRaw);
    const [row] = await db
        .select()
        .from(emailOtps)
        .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose)))
        .orderBy(desc(emailOtps.createdAt))
        .limit(1);
    return row ?? null;
}

/**
 * Returns true if a new code can be issued (no recent successful send within
 * the cooldown window).
 */
export async function canResend(emailRaw: string, purpose: OtpPurpose): Promise<boolean> {
    const latest = await latestOtpFor(emailRaw, purpose);
    if (!latest || !latest.createdAt) return true;
    const ageSec = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
    return ageSec >= OTP_RESEND_COOLDOWN_SECONDS;
}

export type OtpVerifyResult =
    | { ok: true }
    | { ok: false; reason: 'not_found' | 'expired' | 'used' | 'too_many_attempts' | 'invalid_code' };

/**
 * Verify a presented code against the most recent unused OTP for this
 * (email, purpose). On success the row is marked `used`. On a wrong code
 * the attempt counter is incremented and the row is auto-burned at
 * `OTP_MAX_ATTEMPTS` to defeat brute force.
 */
export async function verifyOtp(
    emailRaw: string,
    purpose: OtpPurpose,
    code: string,
): Promise<OtpVerifyResult> {
    const email = normalizeEmail(emailRaw);
    const [row] = await db
        .select()
        .from(emailOtps)
        .where(
            and(
                eq(emailOtps.email, email),
                eq(emailOtps.purpose, purpose),
                eq(emailOtps.used, false),
                gt(emailOtps.expiresAt, new Date()),
            ),
        )
        .orderBy(desc(emailOtps.createdAt))
        .limit(1);

    if (!row) return { ok: false, reason: 'not_found' };
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
        await db.update(emailOtps).set({ used: true }).where(eq(emailOtps.id, row.id));
        return { ok: false, reason: 'too_many_attempts' };
    }

    const matches = await bcrypt.compare(code, row.codeHash);
    if (!matches) {
        const newAttempts = row.attempts + 1;
        const burn = newAttempts >= OTP_MAX_ATTEMPTS;
        await db
            .update(emailOtps)
            .set({ attempts: newAttempts, used: burn })
            .where(eq(emailOtps.id, row.id));
        if (burn) return { ok: false, reason: 'too_many_attempts' };
        return { ok: false, reason: 'invalid_code' };
    }

    await db.update(emailOtps).set({ used: true }).where(eq(emailOtps.id, row.id));
    return { ok: true };
}

/**
 * Best-effort cleanup of OTP rows older than 24h. Safe to call from a
 * background job; not currently scheduled but exposed for ops scripts.
 */
export async function purgeStaleOtps(): Promise<void> {
    await db.execute(sql`DELETE FROM email_otps WHERE created_at < NOW() - INTERVAL '24 hours'`);
}
