'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ApiError, api } from '@/lib/api';
import Nav from '@/components/landing/Nav';
import Footer from '@/components/landing/Footer';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
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
            <VerifyEmailInner />
        </Suspense>
    );
}

function VerifyEmailInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = (searchParams.get('email') ?? '').trim().toLowerCase();

    const [digits, setDigits] = useState<string[]>(() => Array(6).fill(''));
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    const code = digits.join('');
    const isComplete = digits.every((d) => /\d/.test(d));

    useEffect(() => {
        if (!email) router.replace('/signup');
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
        } else if (e.key === 'Enter' && isComplete) {
            void handleSubmit();
        }
    }

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault();
        setError('');
        setInfo('');
        if (!/^\d{6}$/.test(code)) {
            setError('Enter the 6-digit code from your email.');
            return;
        }
        setLoading(true);
        try {
            await api.verifyEmail({ email, code });
            // Try to auto-establish a NextAuth session using the password the
            // user typed on signup. If sessionStorage was cleared we fall back
            // to the login page with a success banner.
            let pw: string | null = null;
            try {
                pw = sessionStorage.getItem(`ligma:pending-pw:${email}`);
                sessionStorage.removeItem(`ligma:pending-pw:${email}`);
            } catch {
                /* unavailable: fall through */
            }
            if (pw) {
                const result = await signIn('credentials', {
                    email,
                    password: pw,
                    redirect: false,
                });
                if (result && !result.error) {
                    router.push('/dashboard');
                    router.refresh();
                    return;
                }
            }
            router.push(`/login?verified=1&email=${encodeURIComponent(email)}`);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === 'invalid_code') setError('Incorrect code. Try again.');
                else if (err.code === 'expired' || err.code === 'not_found')
                    setError('Code expired. Request a new one.');
                else if (err.code === 'too_many_attempts')
                    setError('Too many attempts. Request a new code.');
                else setError(err.message || 'Verification failed.');
            } else {
                setError(err instanceof Error ? err.message : 'Verification failed.');
            }
            setLoading(false);
        }
    }

    async function handleResend() {
        setError('');
        setInfo('');
        setResending(true);
        try {
            await api.resendVerification({ email });
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
                                One last step
                            </p>
                            <h1
                                className="mt-4 font-bold leading-[1.05] tracking-[-0.035em]"
                                style={{
                                    fontSize: 'clamp(2.4rem, 4vw, 3.4rem)',
                                    color: '#ede4d0',
                                }}
                            >
                                Confirm it's<br />
                                <span style={{ color: '#be9460' }}>really you.</span>
                            </h1>
                            <p
                                className="mt-6 text-[0.975rem] leading-[1.82]"
                                style={{ color: 'rgba(237,228,208,0.42)' }}
                            >
                                We sent a one-time 6-digit code to your inbox. Drop it in on the
                                right and you'll land straight in your dashboard. Codes expire
                                after 15 minutes.
                            </p>

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
                                    Verify your email
                                </h2>
                                <p
                                    className="mt-1 text-[0.875rem]"
                                    style={{ color: 'rgba(237,228,208,0.38)' }}
                                >
                                    Enter the 6-digit code we sent to{' '}
                                    <span
                                        className="font-medium"
                                        style={{ color: '#ede4d0' }}
                                    >
                                        {email || '…'}
                                    </span>
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                                                    border: `1px solid ${d
                                                            ? 'rgba(190,148,96,0.32)'
                                                            : 'rgba(190,148,96,0.16)'
                                                        }`,
                                                    color: '#ede4d0',
                                                }}
                                            />
                                        ))}
                                    </div>
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
                                    disabled={loading || !isComplete}
                                    className="w-full rounded-xl py-2.5 text-[0.9rem] font-semibold transition hover:opacity-90 disabled:opacity-40"
                                    style={{ background: '#ede4d0', color: '#0b0906' }}
                                >
                                    {loading ? 'Verifying…' : 'Verify email  →'}
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
                                    href="/signup"
                                    className="transition hover:opacity-100"
                                    style={{ color: 'rgba(237,228,208,0.42)' }}
                                >
                                    Use a different email
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
