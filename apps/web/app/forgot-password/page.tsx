'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ApiError, api } from '@/lib/api';
import Nav from '@/components/landing/Nav';
import Footer from '@/components/landing/Footer';

export default function ForgotPasswordPage() {
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
            <ForgotPasswordInner />
        </Suspense>
    );
}

function ForgotPasswordInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialEmail = searchParams.get('email') ?? '';

    const [email, setEmail] = useState(initialEmail);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.forgotPassword({ email });
            // Server response is identical whether the email exists or not,
            // to prevent enumeration. We always advance.
            router.push(`/reset-password?email=${encodeURIComponent(email)}`);
        } catch (err) {
            if (err instanceof ApiError && err.status === 429) {
                const body = err.body as { retryAfterSeconds?: number };
                setError(
                    `Please wait ${body?.retryAfterSeconds ?? 60}s before requesting another code.`,
                );
            } else {
                setError(err instanceof Error ? err.message : 'Could not send reset code.');
            }
            setLoading(false);
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
                                Account recovery
                            </p>
                            <h1
                                className="mt-4 font-bold leading-[1.05] tracking-[-0.035em]"
                                style={{
                                    fontSize: 'clamp(2.4rem, 4vw, 3.4rem)',
                                    color: '#ede4d0',
                                }}
                            >
                                Forgot your<br />
                                <span style={{ color: '#be9460' }}>password?</span>
                            </h1>
                            <p
                                className="mt-6 text-[0.975rem] leading-[1.82]"
                                style={{ color: 'rgba(237,228,208,0.42)' }}
                            >
                                Happens to all of us. Enter the email tied to your Ligma account
                                and we'll send a one-time code. The link in the email expires in
                                15 minutes — same as the code on screen.
                            </p>

                            <ol className="mt-10 flex flex-col gap-4">
                                {[
                                    'Enter your email address.',
                                    'Check your inbox for the 6-digit code.',
                                    'Set a new password and sign in.',
                                ].map((step, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-4"
                                    >
                                        <div
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
                                            style={{
                                                border: '1px solid rgba(190,148,96,0.32)',
                                                background: 'rgba(190,148,96,0.08)',
                                                color: '#be9460',
                                            }}
                                        >
                                            {i + 1}
                                        </div>
                                        <span
                                            className="pt-1 text-[0.9rem]"
                                            style={{ color: 'rgba(237,228,208,0.62)' }}
                                        >
                                            {step}
                                        </span>
                                    </li>
                                ))}
                            </ol>
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
                                    We'll email you a 6-digit reset code.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        className="text-[0.8rem] font-medium"
                                        style={{ color: 'rgba(237,228,208,0.55)' }}
                                    >
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors placeholder:opacity-30"
                                        style={{
                                            background: 'rgba(190,148,96,0.04)',
                                            border: '1px solid rgba(190,148,96,0.16)',
                                            color: '#ede4d0',
                                        }}
                                        onFocus={(e) =>
                                            (e.currentTarget.style.borderColor =
                                                'rgba(190,148,96,0.48)')
                                        }
                                        onBlur={(e) =>
                                            (e.currentTarget.style.borderColor =
                                                'rgba(190,148,96,0.16)')
                                        }
                                    />
                                </div>

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
                                    disabled={loading || !email}
                                    className="mt-1 w-full rounded-xl py-2.5 text-[0.9rem] font-semibold transition hover:opacity-90 disabled:opacity-40"
                                    style={{ background: '#ede4d0', color: '#0b0906' }}
                                >
                                    {loading ? 'Sending…' : 'Send reset code  →'}
                                </button>
                            </form>

                            <div
                                className="my-6 h-px w-full"
                                style={{ background: 'rgba(190,148,96,0.1)' }}
                            />

                            <p
                                className="text-center text-[0.875rem]"
                                style={{ color: 'rgba(237,228,208,0.38)' }}
                            >
                                Remembered it?{' '}
                                <Link
                                    href="/login"
                                    className="font-semibold transition hover:opacity-100"
                                    style={{ color: '#be9460' }}
                                >
                                    Back to sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
