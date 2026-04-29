'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { env } from '@/lib/env';

const EASE = [0.22, 0.1, 0.36, 1] as const;

export default function CTA() {
    const { status } = useSession();
    const authed = status === 'authenticated';
    const demoHref = `/room/${env.defaultRoom}`;

    return (
        <section className="relative overflow-hidden bg-[#0b0906]">

            {/* Warm radial bloom */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(190,148,96,0.1) 0%, transparent 68%)',
                }}
            />

            {/* Top divider line */}
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 mx-auto max-w-4xl"
                style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(190,148,96,0.25) 40%, rgba(190,148,96,0.25) 60%, transparent 100%)' }}
            />

            <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-40 text-center">

                {/* Eyebrow */}
                {/* Headline */}
                <motion.h2
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, delay: 0.06, ease: EASE }}
                    className="mb-7 font-poppins font-bold leading-[1.03] tracking-[-0.04em]"
                    style={{
                        fontSize: 'clamp(2.4rem, 5.5vw, 5rem)',
                        color: '#ede4d0',
                    }}
                >
                    Stop coordinating.{' '}
                    <br className="hidden sm:block" />
                    <span
                        style={{
                            background: 'linear-gradient(90deg, #be9460 0%, #c9a06e 50%, #4a2510 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        Start thinking.
                    </span>
                </motion.h2>

                {/* Sub */}
                <motion.p
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
                    className="mb-12 max-w-[520px] text-[1.05rem] leading-[1.76]"
                    style={{ color: 'rgba(237,228,208,0.46)' }}
                >
                    Open a canvas and invite your team in seconds. No setup. No seat licenses.
                    Just a shared surface where the work actually happens.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.65, delay: 0.18, ease: EASE }}
                    className="flex flex-col items-center gap-4 sm:flex-row sm:gap-3"
                >
                    <Link
                        href={demoHref}
                        className="rounded-xl px-8 py-3.5 text-[15px] font-semibold text-[#0b0906] transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                        style={{ background: '#ede4d0', minWidth: '190px', textAlign: 'center' }}
                    >
                        Open a canvas →
                    </Link>
                    <Link
                        href={authed ? '/dashboard' : '/signup'}
                        className="rounded-xl border px-8 py-3.5 text-[15px] font-medium text-[#ede4d0]/70 transition-all duration-200 hover:border-[#be9460]/50 hover:text-[#ede4d0] active:scale-[0.98]"
                        style={{ borderColor: 'rgba(190,148,96,0.22)', minWidth: '190px', textAlign: 'center' }}
                    >
                        {authed ? 'Go to dashboard' : 'Create free account'}
                    </Link>
                </motion.div>

                {/* Trust micro-line */}
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
                    className="mt-10 font-mono text-[10px] uppercase tracking-[0.26em]"
                    style={{ color: 'rgba(190,148,96,0.32)' }}
                >
                    no credit card · no workspace setup · open a room in &lt;5s
                </motion.p>
            </div>
        </section>
    );
}
