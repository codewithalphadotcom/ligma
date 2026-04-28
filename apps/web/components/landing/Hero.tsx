'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import CanvasPreview from './CanvasPreview';

const EASE = [0.22, 0.1, 0.36, 1] as const;

const fadeUp = {
    hidden: { opacity: 0, y: 22 },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.85, delay: 0.06 + i * 0.1, ease: EASE },
    }),
};

interface HeroProps {
    demoRoom: string;
}

export default function Hero({ demoRoom }: HeroProps) {
    const { status } = useSession();
    const authed = status === 'authenticated';
    return (
        <section className="relative overflow-hidden bg-[#0b0906]">

            {/* Warm brass grid */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(190,148,96,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.09) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                }}
            />

            {/* Soft warm radial vignette at top center */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 65% 50% at 50% 0%, rgba(190,148,96,0.08) 0%, transparent 65%)',
                }}
            />

            <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-28 pb-32 text-center">

                {/* Headline — 2 lines */}
                <motion.h1
                    custom={0}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="font-poppins text-[clamp(2.6rem,5.8vw,5.5rem)] font-bold leading-[0.97] tracking-[-0.04em] text-[#ede4d0]"
                >
                    The canvas where<br />
                    <span
                        style={{
                            background: 'linear-gradient(90deg, #be9460 0%, #4a2510 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        teams think together.
                    </span>
                </motion.h1>

                {/* Subtext */}
                <motion.p
                    custom={2}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="mx-auto mt-9 max-w-[800px] text-[1.05rem] leading-[1.72] text-[#ede4d0]/48"
                >
                    An infinite shared canvas with live cursors, conflict-free CRDT sync, and per-node access control —
                    plus an AI layer that quietly turns every team discussion into a structured, shareable task list.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    custom={3}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="mt-10 flex flex-wrap items-center justify-center gap-3"
                >
                    <Link
                        href={`/room/${demoRoom}`}
                        className="group inline-flex items-center gap-2 rounded-xl bg-[#ede4d0] px-7 py-3.5 text-[14px] font-semibold text-[#0b0906] transition-all hover:bg-[#d8ceb8]"
                        style={{ boxShadow: '0 16px 36px -8px rgba(190,148,96,0.25)' }}
                    >
                        Open a canvas
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                    <Link
                        href={authed ? '/dashboard' : '/signup'}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#be9460]/22 bg-[#be9460]/4 px-7 py-3.5 text-[14px] font-medium text-[#ede4d0]/65 transition-all hover:border-[#be9460]/45 hover:text-[#ede4d0]/90"
                    >
                        {authed ? 'Dashboard' : 'Save your canvases'}
                    </Link>
                </motion.div>

                {/* Canvas wireframe preview */}
                <motion.div
                    initial={{ opacity: 0, y: 36 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.05, delay: 0.55, ease: EASE }}
                    className="mt-20 w-full"
                >
                    <CanvasPreview />
                </motion.div>

                {/* Stats row */}
                <motion.div
                    custom={5}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className="mt-16 flex flex-wrap items-center justify-center gap-x-12 gap-y-5"
                >
                    {[
                        ['∞ × ∞', 'Canvas size'],
                        ['<100ms', 'Sync latency'],
                        ['Y.js', 'CRDT engine'],
                        ['Per-node', 'Access control'],
                    ].map(([value, label]) => (
                        <div key={label} className="flex flex-col items-center gap-1.5">
                            <span
                                className="font-poppins text-[15px] font-semibold"
                                style={{ color: 'rgba(190,148,96,0.88)' }}
                            >
                                {value}
                            </span>
                            <span className="font-mono text-[9px] tracking-[0.28em] text-[#ede4d0]/28 uppercase">
                                {label}
                            </span>
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Bottom hairline */}
            <div className="relative z-10 h-px w-full bg-[#be9460]/10" />
        </section>
    );
}
