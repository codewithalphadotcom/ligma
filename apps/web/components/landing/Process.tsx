'use client';

import { motion } from 'framer-motion';

const EASE = [0.22, 0.1, 0.36, 1] as const;

interface Step {
    n: string;
    eyebrow: string;
    title: string;
    body: string;
    bullets: { k: string; v: string }[];
    art: 'connect' | 'sync' | 'extract';
}

const steps: Step[] = [
    {
        n: '01',
        eyebrow: 'Open',
        title: 'A room, not an account.',
        body:
            "Hit the canvas link. You're inside. No workspace setup, no per-seat invitations, no admin who has to provision anything for the meeting to start. The room itself is the unit of collaboration — share its URL the way you'd share any other.",
        bullets: [
            { k: 'Auth', v: 'JWT — zero-config' },
            { k: 'Latency', v: 'first paint < 400ms' },
            { k: 'Identity', v: 'name + brass cursor' },
        ],
        art: 'connect',
    },
    {
        n: '02',
        eyebrow: 'Work',
        title: 'Edits resolve before they conflict.',
        body:
            "Two people drag the same node. Three people type into the same text block. The Y.js CRDT engine reconciles every keystroke and every move at the data structure level — there's no merge step, no save button, no \"latest version\" dance. The canvas simply stays consistent.",
        bullets: [
            { k: 'Engine', v: 'Y.Doc · WebSocket' },
            { k: 'Awareness', v: 'cursor + selection sync' },
            { k: 'Persistence', v: 'snapshots + event log' },
        ],
        art: 'sync',
    },
    {
        n: '03',
        eyebrow: 'Decide',
        title: 'The AI watches, you ship.',
        body:
            "The intent layer reads the canvas — nodes, connections, comments, agreed-upon decisions — and proposes a structured task list. Approve what's right, edit what isn't, discard what's noise. The list updates as the canvas evolves, so the work and the thinking never drift apart.",
        bullets: [
            { k: 'Model', v: 'configurable · per-room' },
            { k: 'Output', v: 'structured task list' },
            { k: 'Trigger', v: 'manual or scheduled' },
        ],
        art: 'extract',
    },
];

/* ── Step illustrations ──────────────────────────────────────── */

function StepArt({ kind }: { kind: Step['art'] }) {
    if (kind === 'connect') {
        return (
            <svg viewBox="0 0 200 140" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <radialGradient id="g-connect" cx="50%" cy="50%">
                        <stop offset="0%" stopColor="#be9460" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#be9460" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <circle cx="100" cy="70" r="58" fill="url(#g-connect)" />
                {/* central node */}
                <rect x="84" y="58" width="32" height="24" rx="4" fill="rgba(190,148,96,0.18)" stroke="rgba(190,148,96,0.5)" strokeWidth="0.7" />
                {/* satellites */}
                {[
                    [30, 40], [170, 36], [38, 110], [172, 108],
                ].map(([x, y], i) => (
                    <g key={i}>
                        <line x1="100" y1="70" x2={x} y2={y} stroke="rgba(190,148,96,0.3)" strokeWidth="0.6" strokeDasharray="2 2" />
                        <circle cx={x} cy={y} r="3.2" fill="rgba(237,228,208,0.6)" />
                    </g>
                ))}
            </svg>
        );
    }
    if (kind === 'sync') {
        return (
            <svg viewBox="0 0 200 140" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
                {/* two converging streams */}
                {[0, 1, 2, 3, 4].map((i) => (
                    <g key={i}>
                        <line
                            x1="20" y1={30 + i * 20}
                            x2="100" y2="70"
                            stroke="rgba(190,148,96,0.22)"
                            strokeWidth="0.5"
                        />
                        <line
                            x1="180" y1={30 + i * 20}
                            x2="100" y2="70"
                            stroke="rgba(190,148,96,0.22)"
                            strokeWidth="0.5"
                        />
                    </g>
                ))}
                {/* pulse circle */}
                <circle cx="100" cy="70" r="14" fill="rgba(190,148,96,0.12)" stroke="rgba(190,148,96,0.55)" strokeWidth="0.8" />
                <circle cx="100" cy="70" r="3" fill="rgba(237,228,208,0.85)" />
                {/* labels at edges */}
                <text x="14" y="22" fontSize="6" fill="rgba(237,228,208,0.4)" fontFamily="monospace" letterSpacing="0.5">CLIENT A</text>
                <text x="156" y="22" fontSize="6" fill="rgba(237,228,208,0.4)" fontFamily="monospace" letterSpacing="0.5">CLIENT B</text>
                <text x="84" y="98" fontSize="5.5" fill="rgba(190,148,96,0.5)" fontFamily="monospace" letterSpacing="0.6">Y.DOC</text>
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 200 140" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            {/* canvas blob on left */}
            <rect x="14" y="22" width="76" height="96" rx="6" fill="rgba(190,148,96,0.05)" stroke="rgba(190,148,96,0.28)" strokeWidth="0.7" />
            {[30, 50, 70, 90].map((y, i) => (
                <rect key={i} x="22" y={y} width={i % 2 === 0 ? 50 : 36} height="6" rx="1.5" fill="rgba(190,148,96,0.18)" />
            ))}
            {/* arrow */}
            <line x1="96" y1="70" x2="118" y2="70" stroke="rgba(190,148,96,0.5)" strokeWidth="0.8" strokeDasharray="2 2" />
            <polygon points="118,67 124,70 118,73" fill="rgba(190,148,96,0.55)" />
            {/* task list on right */}
            <rect x="126" y="22" width="60" height="96" rx="6" fill="rgba(237,228,208,0.04)" stroke="rgba(237,228,208,0.18)" strokeWidth="0.7" />
            {[32, 48, 64, 80, 96].map((y, i) => (
                <g key={i}>
                    <rect x="132" y={y} width="3" height="3" rx="0.6" fill="rgba(190,148,96,0.6)" />
                    <rect x="138" y={y} width={42 - i * 4} height="3" rx="0.8" fill="rgba(237,228,208,0.4)" />
                </g>
            ))}
        </svg>
    );
}

/* ── Section ─────────────────────────────────────────────────── */

export default function Process() {
    return (
        <section id="process" className="relative bg-[#0b0906]">
            <div className="mx-auto w-full max-w-6xl px-6 py-32">

                {/* Section label */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.65, ease: EASE }}
                    className="mb-20 flex flex-col gap-6"
                >
                    <h2
                        className="font-poppins font-bold leading-[1.05] tracking-[-0.03em]"
                        style={{
                            fontSize: 'clamp(2rem, 4vw, 3.4rem)',
                            color: '#ede4d0',
                            maxWidth: '720px',
                        }}
                    >
                        Three steps from cold link to{' '}
                        <span
                            style={{
                                background: 'linear-gradient(90deg, #be9460 0%, #4a2510 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            shipped decision.
                        </span>
                    </h2>
                </motion.div>

                {/* Steps */}
                <div className="flex flex-col gap-32">
                    {steps.map((s, i) => (
                        <motion.div
                            key={s.n}
                            initial={{ opacity: 0, y: 28 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.85, ease: EASE }}
                            className={`grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-20 ${i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                                }`}
                        >
                            {/* Copy */}
                            <div className="flex flex-col gap-6">
                                <h3
                                    className="font-poppins font-bold leading-[1.1] tracking-[-0.025em]"
                                    style={{
                                        fontSize: 'clamp(1.7rem, 3vw, 2.5rem)',
                                        color: '#ede4d0',
                                    }}
                                >
                                    {s.title}
                                </h3>

                                <p
                                    className="text-[1rem] leading-[1.78]"
                                    style={{ color: 'rgba(237,228,208,0.5)' }}
                                >
                                    {s.body}
                                </p>

                                {/* Bullets — key/value strip */}
                                <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
                                    {s.bullets.map((b) => (
                                        <div key={b.k} className="flex flex-col gap-1.5">
                                            <span
                                                className="font-mono text-[9.5px] tracking-[0.22em] uppercase"
                                                style={{ color: 'rgba(190,148,96,0.5)' }}
                                            >
                                                {b.k}
                                            </span>
                                            <span
                                                className="font-mono text-[12px]"
                                                style={{ color: 'rgba(237,228,208,0.7)' }}
                                            >
                                                {b.v}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Art */}
                            <div
                                className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl"
                                style={{
                                    border: '1px solid rgba(190,148,96,0.13)',
                                    background:
                                        'linear-gradient(160deg, rgba(190,148,96,0.04) 0%, #0d0a07 60%)',
                                }}
                            >
                                {/* Inner brass grid */}
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        backgroundImage:
                                            'linear-gradient(rgba(190,148,96,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.045) 1px, transparent 1px)',
                                        backgroundSize: '36px 36px',
                                    }}
                                />
                                <div className="relative h-full w-full p-10">
                                    <StepArt kind={s.art} />
                                </div>
                                {/* Step number embossed */}
                                <span
                                    className="font-poppins absolute right-5 bottom-3 font-bold leading-none"
                                    style={{
                                        fontSize: '4rem',
                                        color: 'rgba(190,148,96,0.08)',
                                        letterSpacing: '-0.04em',
                                    }}
                                >
                                    {s.n}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
