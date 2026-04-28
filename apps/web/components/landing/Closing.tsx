'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const EASE = [0.22, 0.1, 0.36, 1] as const;

interface ClosingProps {
    demoRoom: string;
}

export default function Closing({ demoRoom }: ClosingProps) {
    return (
        <section
            className="relative overflow-hidden bg-[#0b0906]"
            style={{ borderTop: '1px solid rgba(190,148,96,0.08)' }}
        >
            {/* Warm radial glow — rises from bottom */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 55% at 50% 100%, rgba(190,148,96,0.07) 0%, transparent 65%)',
                }}
            />

            {/* Ghost background word */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none"
            >
                <span
                    className="font-poppins font-bold leading-none tracking-[-0.06em]"
                    style={{
                        fontSize: 'clamp(7rem, 22vw, 20rem)',
                        color: 'rgba(190,148,96,0.025)',
                    }}
                >
                    THINK
                </span>
            </div>

            {/* Brass grid — same as hero, feels continuous */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(190,148,96,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.06) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                }}
            />

            <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-40 text-center">

                {/* Eyebrow */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="mb-10 flex items-center gap-4"
                >
                    <div className="h-px w-10" style={{ background: 'rgba(190,148,96,0.22)' }} />
                    <span
                        className="font-mono text-[10.5px] tracking-[0.32em] uppercase"
                        style={{ color: 'rgba(190,148,96,0.48)' }}
                    >
                        Get started
                    </span>
                    <div className="h-px w-10" style={{ background: 'rgba(190,148,96,0.22)' }} />
                </motion.div>

                {/* Main heading */}
                <motion.h2
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.88, ease: EASE }}
                    className="font-poppins font-bold leading-[0.96] tracking-[-0.04em]"
                    style={{
                        fontSize: 'clamp(2.6rem, 6.2vw, 5.2rem)',
                        color: '#ede4d0',
                    }}
                >
                    Your team's canvas<br />
                    <span style={{ color: 'rgba(237,228,208,0.28)' }}>
                        is one click away.
                    </span>
                </motion.h2>

                {/* Subtext */}
                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.85, delay: 0.09, ease: EASE }}
                    className="mt-8 max-w-[480px] text-[1rem] leading-[1.72]"
                    style={{ color: 'rgba(237,228,208,0.4)' }}
                >
                    No setup, no per-seat friction. Open a room and your whole team is already inside — cursors live, edits syncing, decisions forming.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.85, delay: 0.17, ease: EASE }}
                    className="mt-10 flex flex-wrap items-center justify-center gap-3"
                >
                    <Link
                        href="/signup"
                        className="group inline-flex items-center gap-2 rounded-xl bg-[#ede4d0] px-7 py-3.5 text-[14px] font-semibold text-[#0b0906] transition-all hover:bg-[#d8ceb8]"
                        style={{ boxShadow: '0 16px 36px -8px rgba(190,148,96,0.25)' }}
                    >
                        Open a canvas
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                    <Link
                        href={`/room/${demoRoom}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#be9460]/22 bg-[#be9460]/4 px-7 py-3.5 text-[14px] font-medium text-[#ede4d0]/65 transition-all hover:border-[#be9460]/45 hover:text-[#ede4d0]/90"
                    >
                        Try the live demo
                    </Link>
                </motion.div>

                {/* Bottom decorative rule */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, delay: 0.3, ease: EASE }}
                    className="mt-24 flex items-center gap-5"
                >
                    <div className="h-px w-16" style={{ background: 'rgba(190,148,96,0.15)' }} />
                    <span
                        className="font-mono text-[9.5px] tracking-[0.3em] uppercase"
                        style={{ color: 'rgba(190,148,96,0.22)' }}
                    >
                        Ligma · Real-time collaborative canvas
                    </span>
                    <div className="h-px w-16" style={{ background: 'rgba(190,148,96,0.15)' }} />
                </motion.div>
            </div>
        </section>
    );
}
