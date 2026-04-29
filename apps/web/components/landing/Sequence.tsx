'use client';

/**
 * Sequence — editorial "how it works" section.
 * Three steps laid out like a premium product publication:
 *  - Giant ghost numerals as background watermarks
 *  - Thin brass separator lines between steps
 *  - Generous negative space, no cards or boxes
 *  - Key-value technical strip per step
 */

import { motion } from 'framer-motion';

const EASE = [0.22, 0.1, 0.36, 1] as const;

const steps = [
    {
        n: '01',
        tag: 'Enter',
        title: 'A room, not a workspace.',
        body: "Share a URL. That's the entire onboarding. No admin queues, no seat licenses, no per-user provisioning. The room is the unit of collaboration — its own permissions, its own history, its own identity. You're thinking together before anyone opens a settings page.",
        kv: [
            ['Auth', 'JWT · zero-config'],
            ['Latency', 'first paint < 400ms'],
            ['Identity', 'cursor + display name'],
        ],
    },
    {
        n: '02',
        tag: 'Work',
        title: "Edits that don't conflict.",
        body: "Two people type into the same node. Three people move the same block. Y.js resolves every operation at the data structure level before a conflict can form. No save button. No merge step. The canvas stays consistent the way physics stays consistent — as a property of the system, not a feature.",
        kv: [
            ['Engine', 'Y.Doc · CRDT'],
            ['Transport', 'WebSocket · delta sync'],
            ['Awareness', 'cursors + selections'],
        ],
    },
    {
        n: '03',
        tag: 'Decide',
        title: 'Thinking becomes work.',
        body: "The intent layer reads what your team agreed to — across nodes, connections, comments, and decisions — and surfaces a clean task list. You approve, edit, or discard. The canvas remains the source of truth. The task list is just a fast, careful reader sitting on top of it.",
        kv: [
            ['Model', 'configurable · per-room'],
            ['Output', 'structured task list'],
            ['Loop', 'canvas → tasks → canvas'],
        ],
    },
];

export default function Sequence() {
    return (
        <section id="process" className="relative overflow-hidden bg-[#0b0906]">
            {/* Faint vertical rail — desktop only */}
            <div
                aria-hidden
                className="pointer-events-none absolute bottom-0 top-0 hidden xl:block"
                style={{
                    left: 'max(calc(50% - 600px), 24px)',
                    width: '1px',
                    background:
                        'linear-gradient(to bottom, transparent 0%, rgba(190,148,96,0.14) 8%, rgba(190,148,96,0.14) 92%, transparent 100%)',
                }}
            />

            <div className="mx-auto w-full max-w-6xl px-6 py-32">
                {/* Section label + headline */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.65, ease: EASE }}
                    className="mb-32"
                >
                    <h2
                        className="font-poppins font-bold leading-[1.04] tracking-[-0.03em]"
                        style={{ fontSize: 'clamp(1.75rem, 3.4vw, 3rem)', color: '#ede4d0' }}
                    >
                        Three moves from URL{' '}
                        <span
                            style={{
                                background: 'linear-gradient(90deg, #be9460 0%, #4a2510 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            to shipped.
                        </span>
                    </h2>
                </motion.div>

                {/* Steps */}
                <div className="flex flex-col">
                    {steps.map((step, i) => (
                        <motion.div
                            key={step.n}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true, margin: '-100px' }}
                            transition={{ duration: 0.9, ease: EASE }}
                            className={`relative grid grid-cols-1 gap-8 lg:grid-cols-[148px_1fr] lg:gap-20 ${i < steps.length - 1 ? 'pb-28' : ''}`}
                        >
                            {/* Giant ghost numeral — left column */}
                            <div className="hidden select-none items-start justify-end pt-1 lg:flex">
                                <span
                                    className="font-poppins font-bold leading-none"
                                    style={{
                                        fontSize: '8rem',
                                        color: 'rgba(190,148,96,0.065)',
                                        letterSpacing: '-0.05em',
                                        lineHeight: 1,
                                    }}
                                >
                                    {step.n}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="flex flex-col gap-6">
                                {/* Eyebrow row */}
                                <div className="flex items-center gap-3">
                                    <span
                                        className="font-mono text-[10px] uppercase tracking-[0.3em]"
                                        style={{ color: 'rgba(190,148,96,0.52)' }}
                                    >
                                        {step.tag}
                                    </span>
                                    {/* Mobile step number */}
                                    <span
                                        className="font-mono text-[10px] lg:hidden"
                                        style={{ color: 'rgba(190,148,96,0.25)' }}
                                    >
                                        {step.n}
                                    </span>
                                </div>

                                {/* Title */}
                                <motion.h3
                                    initial={{ opacity: 0, x: -10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true, margin: '-60px' }}
                                    transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
                                    className="font-poppins font-bold leading-[1.06] tracking-[-0.028em]"
                                    style={{
                                        fontSize: 'clamp(1.75rem, 3.2vw, 2.9rem)',
                                        color: '#ede4d0',
                                        maxWidth: '580px',
                                    }}
                                >
                                    {step.title}
                                </motion.h3>

                                {/* Brass rule */}
                                <motion.div
                                    initial={{ scaleX: 0 }}
                                    whileInView={{ scaleX: 1 }}
                                    viewport={{ once: true, margin: '-60px' }}
                                    transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
                                    className="h-px w-12 origin-left"
                                    style={{ background: 'rgba(190,148,96,0.35)' }}
                                />

                                {/* Body */}
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true, margin: '-60px' }}
                                    transition={{ duration: 0.8, delay: 0.14, ease: EASE }}
                                    className="max-w-[580px] text-[1rem] leading-[1.84]"
                                    style={{ color: 'rgba(237,228,208,0.46)' }}
                                >
                                    {step.body}
                                </motion.p>

                                {/* Key-value technical strip */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true, margin: '-40px' }}
                                    transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                                    className="flex flex-wrap gap-x-8 gap-y-2.5 pt-1"
                                >
                                    {step.kv.map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-2">
                                            <span
                                                className="font-mono text-[9.5px] uppercase tracking-[0.22em]"
                                                style={{ color: 'rgba(190,148,96,0.42)' }}
                                            >
                                                {k}
                                            </span>
                                            <span
                                                className="font-mono text-[9.5px]"
                                                style={{ color: 'rgba(237,228,208,0.2)' }}
                                            >
                                                ·
                                            </span>
                                            <span
                                                className="font-mono text-[9.5px]"
                                                style={{ color: 'rgba(237,228,208,0.48)' }}
                                            >
                                                {v}
                                            </span>
                                        </div>
                                    ))}
                                </motion.div>
                            </div>

                            {/* Step separator */}
                            {i < steps.length - 1 && (
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-px lg:left-[168px]"
                                    style={{
                                        background:
                                            'linear-gradient(90deg, rgba(190,148,96,0.14) 0%, transparent 55%)',
                                    }}
                                />
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
