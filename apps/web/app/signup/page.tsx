'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { api } from '@/lib/api';
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

const features = [
  { title: 'Conflict-free sync', desc: 'Y.js CRDT resolves every edit at the data structure level.' },
  { title: 'Per-node permissions', desc: 'Lock exactly the nodes that matter, leave the rest open.' },
  { title: 'AI intent layer', desc: 'Decisions on the canvas become structured tasks automatically.' },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Step 1: create the unverified account on Express. The server
      // emails an OTP — no JWT is returned yet.
      await api.signup({ name, email, password });
      // Stash the password in sessionStorage so the verify page can
      // auto-establish a NextAuth session after the OTP succeeds. This
      // never leaves the tab and is wiped immediately after use.
      try {
        sessionStorage.setItem(`ligma:pending-pw:${email.toLowerCase()}`, password);
      } catch {
        /* sessionStorage may be unavailable; verify page falls back to /login */
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    await signIn('google', { callbackUrl: '/dashboard' });
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
                style={{ fontSize: 'clamp(2.4rem, 4vw, 3.6rem)', color: '#ede4d0' }}
              >
                Collaborate<br />
                <span style={{ color: '#be9460' }}>without waiting.</span>
              </h1>
              <p
                className="mt-6 text-[1rem] leading-[1.75]"
                style={{ color: 'rgba(237,228,208,0.45)' }}
              >
                A real-time canvas where work and thinking live in the same place. Invite anyone — no workspace setup, no licenses to provision.
              </p>

              <div className="mt-10 flex flex-col gap-5">
                {features.map((f) => (
                  <div key={f.title} className="flex items-start gap-4">
                    <span
                      className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: 'rgba(190,148,96,0.7)' }}
                    />
                    <p className="text-[0.9rem] leading-[1.65]">
                      <span className="font-semibold" style={{ color: '#ede4d0' }}>{f.title} — </span>
                      <span style={{ color: 'rgba(237,228,208,0.45)' }}>{f.desc}</span>
                    </p>
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
                  Create account
                </h2>
                <p className="mt-1 text-[0.875rem]" style={{ color: 'rgba(237,228,208,0.38)' }}>
                  Start collaborating in seconds
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
                    Display name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
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
                  <label className="text-[0.8rem] font-medium" style={{ color: 'rgba(237,228,208,0.55)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
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
                  {loading ? 'Creating…' : 'Create account'}
                </button>
              </form>

              <p className="mt-6 text-center text-[0.875rem]" style={{ color: 'rgba(237,228,208,0.38)' }}>
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-semibold transition hover:opacity-100"
                  style={{ color: '#be9460' }}
                >
                  Sign in
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
