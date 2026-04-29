'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const EASE = [0.22, 0.1, 0.36, 1] as const;

/* ── Tab data ─────────────────────────────────────────────────── */

interface TabContent {
    id: string;
    label: string;
    headline: string;
    body: string;
    meta: string;
    nodes: { title: string; sub?: string; left: string; top: string; width: string; dashed?: boolean; tone?: 'brass' | 'plain' }[];
    annotations: string[];
}

const tabs: TabContent[] = [
    {
        id: 'pair',
        label: 'Real-time pairing',
        headline: 'Two minds, one canvas, zero merge conflicts.',
        body:
            "Sit beside a teammate without sitting beside them. Cursors glide in real time. Edits resolve at the CRDT layer before they ever conflict. The room behaves the way a whiteboard would, if a whiteboard were also instant, infinite, and remembered everything.",
        meta: 'session · y.js awareness · live',
        nodes: [
            { title: 'auth.ts', sub: 'alice editing', left: '6%', top: '14%', width: '24%', tone: 'brass' },
            { title: 'session middleware', sub: 'open question →', left: '40%', top: '8%', width: '26%', dashed: true },
            { title: 'JWT refresh flow', sub: 'ben · 12s ago', left: '70%', top: '22%', width: '22%' },
            { title: 'race condition?', sub: '↳ 2 comments', left: '22%', top: '60%', width: '24%', dashed: true },
            { title: 'extract to hook', sub: 'agreed · ship', left: '58%', top: '64%', width: '24%', tone: 'brass' },
        ],
        annotations: ['alice', 'ben'],
    },
    {
        id: 'plan',
        label: 'Async planning',
        headline: 'A planning surface that survives the meeting.',
        body:
            "Drop ideas at 11pm. Your teammate refines them at 7am. The canvas keeps every node, every connection, every comment thread — without forcing a sync moment. When the standup happens, the discussion is already structured.",
        meta: 'planning · room/q3-roadmap · 4 contributors',
        nodes: [
            { title: 'Q3 themes', sub: '3 anchors', left: '4%', top: '8%', width: '22%', tone: 'brass' },
            { title: 'reduce time-to-room', sub: 'priority · high', left: '32%', top: '14%', width: '24%' },
            { title: 'AI extraction loop', sub: 'experimental', left: '62%', top: '8%', width: '24%', dashed: true },
            { title: 'pricing v2', sub: 'blocked · waiting', left: '8%', top: '52%', width: '22%', dashed: true },
            { title: 'observability', sub: 'carol owns', left: '38%', top: '58%', width: '22%' },
            { title: 'docs refresh', sub: 'low priority', left: '66%', top: '60%', width: '22%' },
        ],
        annotations: ['alice', 'carol'],
    },
    {
        id: 'review',
        label: 'Architecture review',
        headline: 'Reason about systems, not slides.',
        body:
            "Sketch the box-and-arrow diagram, then move inside it. Tag a node with a question. Lock it to senior reviewers. Watch decisions form on the canvas instead of in a thread that gets lost three hours later. The review is the artifact.",
        meta: 'review · room/arch-2026q2 · gated · senior+',
        nodes: [
            { title: 'API gateway', sub: 'edge · cloudflare', left: '6%', top: '10%', width: '22%', tone: 'brass' },
            { title: 'auth service', sub: 'questioned ✱', left: '34%', top: '8%', width: '22%', dashed: true },
            { title: 'event bus', sub: 'kafka · confirmed', left: '64%', top: '12%', width: '22%' },
            { title: 'core db', sub: 'postgres + read replica', left: '20%', top: '52%', width: '26%', tone: 'brass' },
            { title: 'cache layer', sub: 'redis · per-region', left: '54%', top: '54%', width: '24%' },
            { title: 'analytics sink', sub: 'sampled 1/100', left: '34%', top: '78%', width: '24%', dashed: true },
        ],
        annotations: ['alice', 'ben'],
    },
    {
        id: 'ai',
        label: 'AI task extraction',
        headline: 'The decisions you make become the work you do.',
        body:
            "An intent layer reads what your team actually agreed to — across nodes, comments, and connections — and proposes a structured task list. You approve, edit, or discard. The canvas remains the source of truth; the task list is just a clean view onto it.",
        meta: 'intent · gpt-5.5 · 11 candidate tasks',
        nodes: [
            { title: 'launch checklist', sub: '↳ AI: 11 tasks', left: '6%', top: '12%', width: '26%', tone: 'brass' },
            { title: 'wire payments → flagged', sub: 'priority · high', left: '40%', top: '10%', width: '26%' },
            { title: 'docs page · /pricing', sub: 'sarah · open', left: '70%', top: '20%', width: '22%' },
            { title: 'load test → 5k users', sub: 'devon · in flight', left: '14%', top: '58%', width: '26%', dashed: true },
            { title: 'social proof copy', sub: 'marketing · pending', left: '46%', top: '60%', width: '24%' },
            { title: 'rollback plan ✱', sub: 'AI flagged · missing', left: '72%', top: '60%', width: '22%', dashed: true },
        ],
        annotations: ['ai', 'devon'],
    },
];

/* ── Mock canvas mini-render ──────────────────────────────────── */

function MockCanvas({ tab }: { tab: TabContent }) {
    return (
        <div
            className="relative h-[440px] w-full overflow-hidden rounded-2xl"
            style={{
                border: '1px solid rgba(190,148,96,0.16)',
                background: 'linear-gradient(160deg, rgba(190,148,96,0.035) 0%, #0e0b08 55%)',
                boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7)',
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid rgba(190,148,96,0.1)' }}
            >
                <div className="flex items-center gap-2.5">
                    <span
                        className="sync-dot inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: 'rgba(190,148,96,0.85)' }}
                    />
                    <span
                        className="font-mono text-[10px] tracking-[0.24em] uppercase"
                        style={{ color: 'rgba(237,228,208,0.42)' }}
                    >
                        {tab.meta}
                    </span>
                </div>
                <span
                    className="font-mono text-[9px] tracking-wider uppercase"
                    style={{ color: 'rgba(190,148,96,0.32)' }}
                >
                    {tab.id}
                </span>
            </div>

            {/* Canvas body */}
            <div className="relative h-[calc(100%-92px)]">
                {/* Grid */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(190,148,96,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.055) 1px, transparent 1px)',
                        backgroundSize: '44px 44px',
                    }}
                />

                {/* Nodes */}
                {tab.nodes.map((n, i) => (
                    <motion.div
                        key={`${tab.id}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.05 + i * 0.04, ease: EASE }}
                        className="absolute flex flex-col gap-1 px-4 py-3"
                        style={{
                            left: n.left,
                            top: n.top,
                            width: n.width,
                            minWidth: '128px',
                            borderRadius: '10px',
                            border: `1px ${n.dashed ? 'dashed' : 'solid'} rgba(190,148,96,${n.tone === 'brass' ? 0.4 : 0.24})`,
                            background:
                                n.tone === 'brass'
                                    ? 'rgba(190,148,96,0.08)'
                                    : 'rgba(190,148,96,0.04)',
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        <p
                            className="font-mono text-[11px] font-medium leading-tight"
                            style={{ color: 'rgba(237,228,208,0.9)' }}
                        >
                            {n.title}
                        </p>
                        {n.sub && (
                            <p
                                className="font-mono text-[9px]"
                                style={{ color: 'rgba(190,148,96,0.65)' }}
                            >
                                {n.sub}
                            </p>
                        )}
                    </motion.div>
                ))}

                {/* Floating cursors */}
                {tab.annotations.map((name, i) => (
                    <motion.div
                        key={`${tab.id}-cursor-${i}`}
                        className="pointer-events-none absolute z-20 flex items-center"
                        style={{
                            left: i === 0 ? '38%' : '70%',
                            top: i === 0 ? '38%' : '46%',
                        }}
                        animate={{
                            x: i === 0 ? [0, 12, -8, 0] : [0, -10, 6, 0],
                            y: i === 0 ? [0, 8, -4, 0] : [0, -6, 10, 0],
                        }}
                        transition={{
                            duration: 7,
                            delay: 0.4 + i * 1.2,
                            repeat: Infinity,
                            repeatType: 'mirror',
                            ease: 'easeInOut',
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M5 3L5 19L9 15L12 22L15 21L12 14L18 14Z"
                                fill="rgba(190,148,96,0.92)"
                                stroke="rgba(11,9,6,0.7)"
                                strokeWidth="1"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="ml-1 rounded bg-[#be9460] px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-[#0b0906]">
                            {name}
                        </span>
                    </motion.div>
                ))}
            </div>

            {/* Footer */}
            <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: '1px solid rgba(190,148,96,0.09)' }}
            >
                <span
                    className="font-mono text-[9px] tracking-[0.22em] uppercase"
                    style={{ color: 'rgba(190,148,96,0.3)' }}
                >
                    crdt · y.js · &lt;100ms sync
                </span>
                <span
                    className="font-mono text-[9px] tracking-[0.22em] uppercase"
                    style={{ color: 'rgba(190,148,96,0.3)' }}
                >
                    {tab.nodes.length} nodes · {tab.annotations.length} live
                </span>
            </div>
        </div>
    );
}

/* ── Section ─────────────────────────────────────────────────── */

export default function Showcase() {
    const [active, setActive] = useState(tabs[0].id);
    const current = tabs.find((t) => t.id === active) ?? tabs[0];

    return (
        <section
            id="showcase"
            className="relative bg-[#0b0906]"
        >
            <div className="mx-auto w-full max-w-6xl px-6 py-32">

                {/* Section label */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.65, ease: EASE }}
                    className="mb-14 flex flex-col items-center gap-6 text-center"
                >
                    <h2
                        className="font-poppins font-bold leading-[1.05] tracking-[-0.03em]"
                        style={{
                            fontSize: 'clamp(2rem, 4vw, 3.4rem)',
                            color: '#ede4d0',
                            maxWidth: '720px',
                        }}
                    >
                        Four ways teams already use{' '}
                        <span
                            style={{
                                background: 'linear-gradient(90deg, #be9460 0%, #4a2510 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            the canvas.
                        </span>
                    </h2>
                </motion.div>

                {/* Tab bar — pill style */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
                    className="mb-12 flex justify-center"
                >
                    <div
                        className="relative flex items-center gap-1 rounded-full p-1.5"
                        style={{
                            border: '1px solid rgba(190,148,96,0.15)',
                            background: 'rgba(190,148,96,0.04)',
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        {tabs.map((t) => {
                            const isActive = t.id === active;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setActive(t.id)}
                                    className="relative z-10 px-5 py-2.5 text-[13.5px] font-medium transition-colors"
                                    style={{
                                        color: isActive
                                            ? '#0b0906'
                                            : 'rgba(237,228,208,0.55)',
                                    }}
                                >
                                    {isActive && (
                                        <motion.span
                                            layoutId="showcase-pill"
                                            className="absolute inset-0 rounded-full"
                                            style={{ background: '#ede4d0' }}
                                            transition={{
                                                type: 'spring',
                                                stiffness: 380,
                                                damping: 32,
                                            }}
                                        />
                                    )}
                                    <span className="relative">{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* ── Capability strip ───────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.65, delay: 0.15, ease: EASE }}
                    className="mb-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4"
                    style={{ border: '1px solid rgba(190,148,96,0.13)' }}
                >
                    {[
                        { stat: '01', label: 'open a room URL' },
                        { stat: '02', label: 'drop nodes · invite team' },
                        { stat: '03', label: 'AI extracts intent' },
                        { stat: '04', label: 'tasks land in board' },
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="flex flex-col items-center gap-1.5 px-6 py-7"
                            style={{ background: 'rgba(190,148,96,0.03)' }}
                        >
                            <span
                                className="font-poppins text-[1.6rem] font-bold tracking-tight"
                                style={{ color: '#ede4d0' }}
                            >
                                {item.stat}
                            </span>
                            <span
                                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                                style={{ color: 'rgba(190,148,96,0.5)' }}
                            >
                                {item.label}
                            </span>
                        </div>
                    ))}
                </motion.div>

                {/* Content panel */}
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-16">

                    {/* Left: copy */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={current.id}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.42, ease: EASE }}
                            className="flex flex-col gap-7"
                        >
                            <span
                                className="font-mono text-[10px] tracking-[0.3em] uppercase"
                                style={{ color: 'rgba(190,148,96,0.55)' }}
                            >
                                {current.label}
                            </span>
                            <h3
                                className="font-poppins font-bold leading-[1.1] tracking-[-0.025em]"
                                style={{
                                    fontSize: 'clamp(1.6rem, 2.8vw, 2.4rem)',
                                    color: '#ede4d0',
                                }}
                            >
                                {current.headline}
                            </h3>
                            <p
                                className="text-[1rem] leading-[1.78]"
                                style={{ color: 'rgba(237,228,208,0.5)' }}
                            >
                                {current.body}
                            </p>

                            {/* Tiny technical strip */}
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
                                {current.meta.split(' · ').map((m) => (
                                    <span
                                        key={m}
                                        className="font-mono text-[10px] tracking-[0.18em] uppercase"
                                        style={{ color: 'rgba(190,148,96,0.42)' }}
                                    >
                                        {m}
                                    </span>
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Right: mock canvas */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={current.id}
                            initial={{ opacity: 0, scale: 0.985 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.985 }}
                            transition={{ duration: 0.45, ease: EASE }}
                        >
                            <MockCanvas tab={current} />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
}
