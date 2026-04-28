'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ApiError, api } from '@/lib/api';
import Nav from '@/components/landing/Nav';
import Footer from '@/components/landing/Footer';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div
                    className="flex flex-1 items-center justify-center bg-[#0b0906] text-sm"
                    style={{ color: 'rgba(237,228,208,0.4)' }}
                >
                    Loading…
                </div>
            }
        >
            <ResetPasswordInner />
        </Suspense>
    );
}

function ResetPasswordInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = (searchParams.get('email') ?? '').trim().toLowerCase();

    const [digits, setDigits] = useState<string[]>(() => Array(6).fill(''));
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    const code = digits.join('');
    const codeComplete = digits.every((d) => /\d/.test(d));

    const strength = useMemo(() => scorePassword(newPassword), [newPassword]);

    useEffect(() => {
        if (!email) router.replace('/forgot-password');
    }, [email, router]);

    useEffect(() => {
        refs.current[0]?.focus();
    }, []);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [cooldown]);

    function setDigitAt(idx: number, value: string) {
        const v = value.replace(/\D/g, '').slice(0, 1);
        setDigits((prev) => {
            const next = [...prev];
            next[idx] = v;
            return next;
        });
        if (v && idx < 5) refs.current[idx + 1]?.focus();
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
        const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!raw) return;
        e.preventDefault();
        const next = Array(6).fill('').map((_, i) => raw[i] ?? '');
        setDigits(next);
        const focusIdx = Math.min(raw.length, 5);
        refs.current[focusIdx]?.focus();
    }

    function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace') {
            if (digits[idx]) {
                setDigitAt(idx, '');
            } else if (idx > 0) {
                refs.current[idx - 1]?.focus();
                setDigitAt(idx - 1, '');
            }
        } else if (e.key === 'ArrowLeft' && idx > 0) {
            refs.current[idx - 1]?.focus();
        } else if (e.key === 'ArrowRight' && idx < 5) {
            refs.current[idx + 1]?.focus();
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setInfo('');
        if (!/^\d{6}$/.test(code)) {
            setError('Enter the 6-digit code from your email.');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await api.resetPassword({ email, code, newPassword });
            router.push(`/login?reset=1&email=${encodeURIComponent(email)}`);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === 'invalid_code') setError('Incorrect code. Try again.');
                else if (err.code === 'expired' || err.code === 'not_found')
                    setError('Code expired. Request a new one.');
                else if (err.code === 'too_many_attempts')
                    setError('Too many attempts. Request a new code.');
                else setError(err.message || 'Reset failed.');
            } else {
                setError(err instanceof Error ? err.message : 'Reset failed.');
            }
            setLoading(false);
        }
    }

    async function handleResend() {
        setError('');
        setInfo('');
        setResending(true);
        try {
            await api.forgotPassword({ email });
            setInfo('A new code has been sent to your email.');
            setCooldown(RESEND_COOLDOWN_SECONDS);
            setDigits(Array(6).fill(''));
            refs.current[0]?.focus();
        } catch (err) {
            if (err instanceof ApiError && err.status === 429) {
                const body = err.body as { retryAfterSeconds?: number };
                const wait = body?.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS;
                setCooldown(wait);
                setError(`Please wait ${wait}s before requesting another code.`);
            } else {
                setError(err instanceof Error ? err.message : 'Could not resend code.');
            }
        } finally {
            setResending(false);
        }
    }

    const matches = confirm.length > 0 && confirm === newPassword;
    const mismatch = confirm.length > 0 && confirm !== newPassword;

    return (
        <>
            <Nav />
            <main
                className="relative flex-1 bg-[#0b0906]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(190,148,96,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.055) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            >
                <div
                    className="mx-auto grid w-full max-w-7xl grid-cols-1 lg:grid-cols-2"
                    style={{ minHeight: 'calc(100vh - 68px)' }}
                >
                    {/* ── Left: copy ── */}
                    <div className="hidden flex-col justify-center px-16 py-24 lg:flex">
                        <div className="max-w-[480px]">
                            <p
                                className="font-mono text-[10px] tracking-[0.28em] uppercase"
                                style={{ color: 'rgba(190,148,96,0.55)' }}
                            >
                                Almost there
                            </p>
                            <h1
                                className="mt-4 font-bold leading-[1.05] tracking-[-0.035em]"
                                style={{
                                    fontSize: 'clamp(2.4rem, 4vw, 3.4rem)',
                                    color: '#ede4d0',
                                }}
                            >
                                Pick a new<br />
                                <span style={{ color: '#be9460' }}>password.</span>
                            </h1>
                            <p
                                className="mt-6 text-[0.975rem] leading-[1.82]"
                                style={{ color: 'rgba(237,228,208,0.42)' }}
                            >
                                Drop in the 6-digit code we sent and choose something only you would
                                use. Codes expire in 15 minutes — request another if yours has gone
                                stale.
                            </p>

                            <ul className="mt-10 space-y-3">
                                <Tip text="At least 8 characters" ok={newPassword.length >= 8} />
                                <Tip text="A mix of letters and numbers" ok={/[a-z]/i.test(newPassword) && /\d/.test(newPassword)} />
                                <Tip text="A symbol makes it stronger" ok={/[^A-Za-z0-9]/.test(newPassword)} />
                            </ul>

                            <div
                                className="mt-10 flex items-center gap-3 rounded-xl px-4 py-3.5"
                                style={{
                                    border: '1px solid rgba(190,148,96,0.18)',
                                    background: 'rgba(190,148,96,0.04)',
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#be9460"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <rect x="3" y="5" width="18" height="14" rx="2" />
                                    <path d="m3 7 9 6 9-6" />
                                </svg>
                                <div className="flex flex-col">
                                    <span
                                        className="font-mono text-[10px] tracking-[0.18em] uppercase"
                                        style={{ color: 'rgba(190,148,96,0.6)' }}
                                    >
                                        Code sent to
                                    </span>
                                    <span
                                        className="text-[0.92rem] font-medium"
                                        style={{ color: '#ede4d0' }}
                                    >
                                        {email || '…'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right: form ── */}
                    <div className="flex items-center justify-center px-6 py-12 lg:px-12">
                        <div
                            className="w-full max-w-[500px] rounded-2xl px-10 py-9"
                            style={{
                                border: '1px solid rgba(237,228,208,0.07)',
                                background: 'rgba(11,9,6,0.38)',
                                backdropFilter: 'blur(48px)',
                                boxShadow:
                                    '0 0 0 1px rgba(190,148,96,0.07), 0 32px 80px rgba(0,0,0,0.45)',
                            }}
                        >
                            <div className="mb-7">
                                <h2
                                    className="text-[1.55rem] font-bold tracking-tight"
                                    style={{ color: '#ede4d0' }}
                                >
                                    Reset password
                                </h2>
                                <p
                                    className="mt-1 text-[0.875rem]"
                                    style={{ color: 'rgba(237,228,208,0.38)' }}
                                >
                                    Enter the code sent to{' '}
                                    <span className="font-medium" style={{ color: '#ede4d0' }}>
                                        {email || '…'}
                                    </span>{' '}
                                    and pick a new password.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                                {/* OTP */}
                                <div className="flex flex-col gap-2.5">
                                    <label
                                        className="text-[0.8rem] font-medium"
                                        style={{ color: 'rgba(237,228,208,0.55)' }}
                                    >
                                        Verification code
                                    </label>
                                    <div className="flex items-center justify-between gap-2">
                                        {digits.map((d, i) => (
                                            <input
                                                key={i}
                                                ref={(el) => {
                                                    refs.current[i] = el;
                                                }}
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                                maxLength={1}
                                                value={d}
                                                onChange={(e) => setDigitAt(i, e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(i, e)}
                                                onPaste={handlePaste}
                                                onFocus={(e) => {
                                                    e.currentTarget.style.borderColor =
                                                        'rgba(190,148,96,0.6)';
                                                    e.currentTarget.style.boxShadow =
                                                        '0 0 0 3px rgba(190,148,96,0.12)';
                                                    e.currentTarget.select();
                                                }}
                                                onBlur={(e) => {
                                                    e.currentTarget.style.borderColor = d
                                                        ? 'rgba(190,148,96,0.32)'
                                                        : 'rgba(190,148,96,0.16)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                                className="h-14 w-full max-w-[58px] rounded-xl text-center font-mono text-[1.4rem] font-semibold outline-none transition-all"
                                                style={{
                                                    background: 'rgba(190,148,96,0.04)',
                                                    border: `1px solid ${
                                                        d
                                                            ? 'rgba(190,148,96,0.32)'
                                                            : 'rgba(190,148,96,0.16)'
                                                    }`,
                                                    color: '#ede4d0',
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* New password */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label
                                            className="text-[0.8rem] font-medium"
                                            style={{ color: 'rgba(237,228,208,0.55)' }}
                                        >
                                            New password
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowPw((v) => !v)}
                                            className="font-mono text-[10px] tracking-[0.18em] uppercase transition hover:opacity-80"
                                            style={{ color: 'rgba(190,148,96,0.7)' }}
                                        >
                                            {showPw ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Min 8 characters"
                                        autoComplete="new-password"
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor =
                                                'rgba(190,148,96,0.48)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor =
                                                'rgba(190,148,96,0.16)';
                                        }}
                                        className="w-full rounded-xl px-3.5 py-2.5 text-[0.9rem] outline-none transition"
                                        style={{
                                            background: 'rgba(190,148,96,0.04)',
                                            border: '1px solid rgba(190,148,96,0.16)',
                                            color: '#ede4d0',
                                        }}
                                    />
                                    {newPassword.length > 0 && (
                                        <div className="mt-1 flex items-center gap-2">
                                            <div
                                                className="flex h-1 flex-1 gap-1 overflow-hidden rounded-full"
                                            >
                                                {[0, 1, 2, 3].map((i) => (
                                                    <div
                                                        key={i}
                                                        className="h-full flex-1 rounded-full transition-colors"
                                                        style={{
                                                            background:
                                                                i < strength.score
                                                                    ? strength.color
                                                                    : 'rgba(237,228,208,0.06)',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span
                                                className="font-mono text-[10px] tracking-[0.18em] uppercase"
                                                style={{ color: strength.color }}
                                            >
                                                {strength.label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm password */}
                                <div className="flex flex-col gap-2">
                                    <label
                                        className="text-[0.8rem] font-medium"
                                        style={{ color: 'rgba(237,228,208,0.55)' }}
                                    >
                                        Confirm password
                                    </label>
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        placeholder="Repeat password"
                                        autoComplete="new-password"
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor =
                                                'rgba(190,148,96,0.48)';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = mismatch
                                                ? 'rgba(220,80,80,0.4)'
                                                : matches
                                                  ? 'rgba(120,200,140,0.4)'
                                                  : 'rgba(190,148,96,0.16)';
                                        }}
                                        className="w-full rounded-xl px-3.5 py-2.5 text-[0.9rem] outline-none transition"
                                        style={{
                                            background: 'rgba(190,148,96,0.04)',
                                            border: `1px solid ${
                                                mismatch
                                                    ? 'rgba(220,80,80,0.4)'
                                                    : matches
                                                      ? 'rgba(120,200,140,0.4)'
                                                      : 'rgba(190,148,96,0.16)'
                                            }`,
                                            color: '#ede4d0',
                                        }}
                                    />
                                    {mismatch && (
                                        <span
                                            className="text-[0.78rem]"
                                            style={{ color: 'rgba(237,160,160,0.85)' }}
                                        >
                                            Passwords don't match.
                                        </span>
                                    )}
                                    {matches && (
                                        <span
                                            className="text-[0.78rem]"
                                            style={{ color: 'rgba(140,220,160,0.85)' }}
                                        >
                                            Passwords match.
                                        </span>
                                    )}
                                </div>

                                {info && (
                                    <p
                                        className="rounded-lg px-4 py-2.5 text-[0.875rem]"
                                        style={{
                                            background: 'rgba(50,150,80,0.1)',
                                            border: '1px solid rgba(50,150,80,0.22)',
                                            color: 'rgba(140,220,160,0.9)',
                                        }}
                                    >
                                        {info}
                                    </p>
                                )}

                                {error && (
                                    <p
                                        className="rounded-lg px-4 py-2.5 text-[0.875rem]"
                                        style={{
                                            background: 'rgba(180,50,50,0.1)',
                                            border: '1px solid rgba(180,50,50,0.22)',
                                            color: 'rgba(237,160,160,0.9)',
                                        }}
                                    >
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={
                                        loading ||
                                        !codeComplete ||
                                        newPassword.length < 8 ||
                                        newPassword !== confirm
                                    }
                                    className="w-full rounded-xl py-2.5 text-[0.9rem] font-semibold transition hover:opacity-90 disabled:opacity-40"
                                    style={{ background: '#ede4d0', color: '#0b0906' }}
                                >
                                    {loading ? 'Updating…' : 'Update password  →'}
                                </button>
                            </form>

                            <div
                                className="my-6 h-px w-full"
                                style={{ background: 'rgba(190,148,96,0.1)' }}
                            />

                            <div className="flex items-center justify-between text-[0.875rem]">
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resending || cooldown > 0}
                                    className="font-medium transition hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ color: '#be9460' }}
                                >
                                    {cooldown > 0
                                        ? `Resend in ${cooldown}s`
                                        : resending
                                          ? 'Sending…'
                                          : 'Resend code'}
                                </button>
                                <Link
                                    href="/login"
                                    className="transition hover:opacity-100"
                                    style={{ color: 'rgba(237,228,208,0.42)' }}
                                >
                                    Back to sign in
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}

function Tip({ text, ok }: { text: string; ok: boolean }) {
    return (
        <li className="flex items-center gap-3">
            <span
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors"
                style={{
                    background: ok ? 'rgba(120,200,140,0.14)' : 'rgba(190,148,96,0.06)',
                    border: `1px solid ${ok ? 'rgba(120,200,140,0.4)' : 'rgba(190,148,96,0.18)'}`,
                }}
            >
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={ok ? 'rgba(140,220,160,0.95)' : 'rgba(190,148,96,0.5)'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </span>
            <span
                className="text-[0.92rem] transition-colors"
                style={{
                    color: ok ? 'rgba(237,228,208,0.78)' : 'rgba(237,228,208,0.42)',
                }}
            >
                {text}
            </span>
        </li>
    );
}

function scorePassword(pw: string): { score: number; label: string; color: string } {
    if (!pw) return { score: 0, label: '', color: 'rgba(237,228,208,0.06)' };
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    const score = Math.min(4, s);
    if (score <= 1) return { score: 1, label: 'Weak', color: 'rgba(220,110,110,0.85)' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'rgba(220,170,90,0.9)' };
    if (score === 3) return { score: 3, label: 'Good', color: 'rgba(190,148,96,1)' };
    return { score: 4, label: 'Strong', color: 'rgba(140,220,160,0.95)' };
}
