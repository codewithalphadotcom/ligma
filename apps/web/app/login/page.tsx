'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ApiError, api } from '@/lib/api';
import Nav from '@/components/landing/Nav';
import Footer from '@/components/landing/Footer';

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-[#0b0906] text-sm" style={{ color: 'rgba(237,228,208,0.4)' }}>
          Loading…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const verified = searchParams.get('verified') === '1';
  const reset = searchParams.get('reset') === '1';
  const initialEmail = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (verified) setInfo('Email verified — you can sign in now.');
    else if (reset) setInfo('Password updated — sign in with your new password.');
  }, [verified, reset]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      // Pre-flight against Express so we can surface the
      // `email_not_verified` signal — NextAuth's Credentials provider
      // collapses every error into a generic CredentialsSignin string.
      try {
        await api.login({ email, password });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'email_not_verified') {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          setError('Invalid email or password');
          setLoading(false);
          return;
        }
        throw err;
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError('Invalid email or password');
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    await signIn('google', { callbackUrl });
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
          {/* ── Left: branded copy ── */}
          <div className="hidden flex-col justify-center px-16 py-24 lg:flex">
            <div className="max-w-[480px]">
              <h1
                className="font-bold leading-[1.05] tracking-[-0.035em]"
                style={{ fontSize: 'clamp(2.4rem, 4vw, 3.4rem)', color: '#ede4d0' }}
              >
                Your canvas is<br />
                <span style={{ color: '#be9460' }}>still live.</span>
              </h1>
              <p
                className="mt-6 text-[0.975rem] leading-[1.82]"
                style={{ color: 'rgba(237,228,208,0.42)' }}
              >
                Every node, comment, and connection your team made is exactly where you left it.
                Ligma keeps your rooms in continuous sync — no refreshes, no merge steps, no lost work.
                Sign back in and pick up mid-thought.
              </p>

              <div className="mt-10 grid grid-cols-3 gap-3">
                {[
                  { value: 'Zero', label: 'merge conflicts' },
                  { value: 'Live', label: 'cursor presence' },
                  { value: 'AI', label: 'intent extraction' },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1.5 rounded-xl px-4 py-3.5"
                    style={{ border: '1px solid rgba(190,148,96,0.1)', background: 'rgba(190,148,96,0.03)' }}
                  >
                    <span className="text-[1.15rem] font-bold tracking-tight" style={{ color: '#be9460' }}>
                      {value}
                    </span>
                    <span className="text-[0.73rem] leading-snug" style={{ color: 'rgba(237,228,208,0.36)' }}>
                      {label}
                    </span>
                  </div>
                ))}
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
                boxShadow: '0 0 0 1px rgba(190,148,96,0.07), 0 32px 80px rgba(0,0,0,0.45)',
              }}
            >
              <div className="mb-7">
                <h2
                  className="text-[1.55rem] font-bold tracking-tight"
                  style={{ color: '#ede4d0' }}
                >
                  Welcome back
                </h2>
                <p className="mt-1 text-[0.875rem]" style={{ color: 'rgba(237,228,208,0.38)' }}>
                  Sign in to your Ligma account
                </p>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl py-2.5 text-[0.875rem] font-medium transition hover:opacity-90 disabled:opacity-50"
                style={{
                  border: '1px solid rgba(190,148,96,0.18)',
                  background: 'rgba(190,148,96,0.06)',
                  color: 'rgba(237,228,208,0.82)',
                }}
              >
                <GoogleIcon />
                {googleLoading ? 'Redirecting…' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: 'rgba(190,148,96,0.1)' }} />
                <span
                  className="font-mono text-[10px] tracking-[0.22em] uppercase"
                  style={{ color: 'rgba(190,148,96,0.4)' }}
                >
                  or
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(190,148,96,0.1)' }} />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.8rem] font-medium" style={{ color: 'rgba(237,228,208,0.55)' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors placeholder:opacity-30"
                    style={{
                      background: 'rgba(190,148,96,0.04)',
                      border: '1px solid rgba(190,148,96,0.16)',
                      color: '#ede4d0',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(190,148,96,0.48)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(190,148,96,0.16)')}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[0.8rem] font-medium" style={{ color: 'rgba(237,228,208,0.55)' }}>
                      Password
                    </label>
                    <Link
                      href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                      className="text-[0.78rem] transition hover:opacity-100"
                      style={{ color: 'rgba(190,148,96,0.6)' }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors placeholder:opacity-40"
                    style={{
                      background: 'rgba(190,148,96,0.04)',
                      border: '1px solid rgba(190,148,96,0.16)',
                      color: '#ede4d0',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(190,148,96,0.48)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(190,148,96,0.16)')}
                  />
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
                  disabled={loading || googleLoading}
                  className="mt-1 w-full rounded-xl py-2.5 text-[0.9rem] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#ede4d0', color: '#0b0906' }}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="mt-6 text-center text-[0.875rem]" style={{ color: 'rgba(237,228,208,0.38)' }}>
                No account?{' '}
                <Link
                  href="/signup"
                  className="font-semibold transition hover:opacity-100"
                  style={{ color: '#be9460' }}
                >
                  Sign up
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
