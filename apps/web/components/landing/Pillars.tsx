'use client';

/**
 * Pillars — three full-width alternating deep-dives into the core
 * technical capabilities. Replaces the generic feature grid.
 *
 * Each pillar occupies a full horizontal row:
 *  - Alternates text-left/visual-right and text-right/visual-left
 *  - Custom SVG composition per pillar (not icon cards)
 *  - Large roman numeral chapter markers
 *  - Generous vertical space — reads like a premium product chapter
 */

import { motion } from 'framer-motion';

const EASE = [0.22, 0.1, 0.36, 1] as const;

/* ── SVG compositions ─────────────────────────────────────────── */

/** CRDT: two client streams converging into one Y.Doc */
function CRDTArt() {
    return (
        <svg
            viewBox="0 0 480 340"
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
        >
            <defs>
                <radialGradient id="crdt-glow" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="#be9460" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#be9460" stopOpacity="0" />
                </radialGradient>
                <marker id="crdt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="rgba(190,148,96,0.45)" />
                </marker>
            </defs>

            {/* Glow behind center */}
            <ellipse cx="240" cy="170" rx="100" ry="70" fill="url(#crdt-glow)" />

            {/* Client A — top left */}
            <rect x="28" y="40" width="110" height="52" rx="8"
                fill="rgba(190,148,96,0.06)" stroke="rgba(190,148,96,0.35)" strokeWidth="0.8" />
            <text x="42" y="62" fontSize="9" fill="rgba(237,228,208,0.7)" fontFamily="monospace" letterSpacing="0.5">CLIENT A</text>
            <text x="42" y="78" fontSize="7.5" fill="rgba(190,148,96,0.5)" fontFamily="monospace">cursor · alice</text>

            {/* Client B — bottom left */}
            <rect x="28" y="248" width="110" height="52" rx="8"
                fill="rgba(190,148,96,0.06)" stroke="rgba(190,148,96,0.35)" strokeWidth="0.8" />
            <text x="42" y="270" fontSize="9" fill="rgba(237,228,208,0.7)" fontFamily="monospace" letterSpacing="0.5">CLIENT B</text>
            <text x="42" y="286" fontSize="7.5" fill="rgba(190,148,96,0.5)" fontFamily="monospace">cursor · ben</text>

            {/* Delta ops from A */}
            {[
                { y: 95, label: 'ins(12,"k")', delay: 0 },
                { y: 118, label: 'del(5,2)', delay: 0.15 },
                { y: 141, label: 'mov(node3)', delay: 0.3 },
            ].map((op) => (
                <g key={op.label}>
                    <motion.rect
                        x={155} y={op.y} width={72} height={16} rx={3}
                        fill="rgba(190,148,96,0.07)"
                        stroke="rgba(190,148,96,0.22)"
                        strokeWidth={0.6}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: [0, 1, 1, 0.4], x: [-8, 0, 0, 0] }}
                        transition={{ duration: 2.8, delay: op.delay, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <motion.text
                        x={161} y={op.y + 11}
                        fontSize={7} fill="rgba(190,148,96,0.65)" fontFamily="monospace"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.8, 0.8, 0.3] }}
                        transition={{ duration: 2.8, delay: op.delay, repeat: Infinity, repeatDelay: 2 }}
                    >
                        {op.label}
                    </motion.text>
                </g>
            ))}

            {/* Delta ops from B */}
            {[
                { y: 185, label: 'ins(7,"re")', delay: 0.4 },
                { y: 208, label: 'attr(bold)', delay: 0.55 },
                { y: 231, label: 'ins(15,".")', delay: 0.7 },
            ].map((op) => (
                <g key={op.label}>
                    <motion.rect
                        x={155} y={op.y} width={72} height={16} rx={3}
                        fill="rgba(237,228,208,0.04)"
                        stroke="rgba(237,228,208,0.12)"
                        strokeWidth={0.6}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: [0, 1, 1, 0.4], x: [-8, 0, 0, 0] }}
                        transition={{ duration: 2.8, delay: op.delay, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <motion.text
                        x={161} y={op.y + 11}
                        fontSize={7} fill="rgba(237,228,208,0.45)" fontFamily="monospace"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.8, 0.8, 0.3] }}
                        transition={{ duration: 2.8, delay: op.delay, repeat: Infinity, repeatDelay: 2 }}
                    >
                        {op.label}
                    </motion.text>
                </g>
            ))}

            {/* Connecting lines — A → center */}
            <line x1="138" y1="66" x2="245" y2="130"
                stroke="rgba(190,148,96,0.18)" strokeWidth="0.6" strokeDasharray="3 3" />
            {/* B → center */}
            <line x1="138" y1="274" x2="245" y2="210"
                stroke="rgba(190,148,96,0.18)" strokeWidth="0.6" strokeDasharray="3 3" />

            {/* Y.Doc — center */}
            <rect x="238" y="128" width="120" height="84" rx="10"
                fill="rgba(190,148,96,0.09)" stroke="rgba(190,148,96,0.5)" strokeWidth="1" />
            <text x="254" y="158" fontSize="10" fill="rgba(237,228,208,0.85)" fontFamily="monospace" letterSpacing="1">Y.DOC</text>
            <text x="254" y="175" fontSize="7.5" fill="rgba(190,148,96,0.55)" fontFamily="monospace">CRDT · merged state</text>
            <text x="254" y="190" fontSize="7" fill="rgba(237,228,208,0.3)" fontFamily="monospace">no conflicts · ever</text>

            {/* Center → right output */}
            <line x1="358" y1="170" x2="420" y2="170"
                stroke="rgba(190,148,96,0.3)" strokeWidth="0.7" markerEnd="url(#crdt-arrow)" />
            <rect x="420" y="148" width="50" height="44" rx="6"
                fill="rgba(190,148,96,0.05)" stroke="rgba(190,148,96,0.25)" strokeWidth="0.7" />
            <text x="431" y="165" fontSize="7" fill="rgba(237,228,208,0.55)" fontFamily="monospace">SYNC</text>
            <text x="429" y="179" fontSize="7" fill="rgba(190,148,96,0.45)" fontFamily="monospace">✓ live</text>

            {/* Pulse on Y.Doc */}
            <motion.circle cx="298" cy="170" r="38"
                fill="none" stroke="rgba(190,148,96,0.12)" strokeWidth="0.8"
                animate={{ r: [38, 52, 38], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
        </svg>
    );
}

/** Per-node ACL: canvas with nodes at different permission states */
function ACLArt() {
    const nodes = [
        { x: 48,  y: 50,  label: 'API schema',    role: 'owner',  locked: false, highlight: true },
        { x: 192, y: 50,  label: 'auth flow',      role: 'senior', locked: true,  highlight: false },
        { x: 336, y: 50,  label: 'design tokens',  role: 'all',    locked: false, highlight: false },
        { x: 48,  y: 190, label: 'payment keys',   role: 'owner',  locked: true,  highlight: true },
        { x: 192, y: 190, label: 'Q3 roadmap',     role: 'viewer', locked: false, highlight: false },
        { x: 336, y: 190, label: 'deploy config',  role: 'senior', locked: true,  highlight: false },
    ];

    return (
        <svg viewBox="0 0 480 320" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
            <defs>
                <radialGradient id="acl-glow" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="#be9460" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#be9460" stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse cx="240" cy="155" rx="180" ry="110" fill="url(#acl-glow)" />

            {/* Grid lines */}
            {[170, 310].map(x => (
                <line key={x} x1={x} y1={30} x2={x} y2={290}
                    stroke="rgba(190,148,96,0.07)" strokeWidth="0.5" />
            ))}
            {[160].map(y => (
                <line key={y} x1={30} y1={y} x2={450} y2={y}
                    stroke="rgba(190,148,96,0.07)" strokeWidth="0.5" />
            ))}

            {nodes.map((n, i) => (
                <motion.g key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: EASE }}
                >
                    {/* Node body */}
                    <rect x={n.x} y={n.y} width="116" height="68" rx="8"
                        fill={n.highlight ? 'rgba(190,148,96,0.1)' : 'rgba(190,148,96,0.04)'}
                        stroke={n.highlight ? 'rgba(190,148,96,0.45)' : 'rgba(190,148,96,0.16)'}
                        strokeWidth="0.8"
                    />
                    {/* Label */}
                    <text x={n.x + 12} y={n.y + 24}
                        fontSize="8.5" fill="rgba(237,228,208,0.75)" fontFamily="monospace">{n.label}</text>
                    {/* Role badge */}
                    <rect x={n.x + 12} y={n.y + 33} width={n.role.length * 5.6 + 8} height="14" rx="3"
                        fill={n.locked ? 'rgba(237,228,208,0.05)' : 'rgba(190,148,96,0.08)'}
                        stroke={n.locked ? 'rgba(237,228,208,0.12)' : 'rgba(190,148,96,0.22)'}
                        strokeWidth="0.5"
                    />
                    <text x={n.x + 16} y={n.y + 43}
                        fontSize="6.5" fill={n.locked ? 'rgba(237,228,208,0.38)' : 'rgba(190,148,96,0.65)'}
                        fontFamily="monospace">{n.role}</text>
                    {/* Lock icon */}
                    {n.locked && (
                        <g transform={`translate(${n.x + 96}, ${n.y + 14})`}>
                            <rect x="-7" y="1" width="14" height="10" rx="2"
                                fill="none" stroke="rgba(237,228,208,0.3)" strokeWidth="0.8" />
                            <path d="M-4,-2 a4,4 0 0 1 8,0 v3" fill="none"
                                stroke="rgba(237,228,208,0.3)" strokeWidth="0.8" />
                        </g>
                    )}
                </motion.g>
            ))}

            {/* Legend */}
            <text x="30" y="305" fontSize="7" fill="rgba(190,148,96,0.3)" fontFamily="monospace" letterSpacing="0.8">
                brass border = elevated · lock = gated · badge = role scope
            </text>
        </svg>
    );
}

/** AI extraction: canvas sticky notes → structured task list */
function AIArt() {
    const notes = [
        { y: 38,  text: 'fix login timeout', tag: 'action',   col: '#fdba74' },
        { y: 103, text: 'use NeonDB over Supabase', tag: 'decision',  col: '#6ee7b7' },
        { y: 168, text: 'should cache layer use Redis?', tag: 'question', col: '#93c5fd' },
        { y: 233, text: 'see RFC 7519 §exp claim', tag: 'ref',      col: '#d8b4fe' },
    ];

    const tasks = [
        { y: 42,  text: 'Fix login timeout before demo', pri: 'high' },
        { y: 100, text: 'Migrate DB to NeonDB', pri: 'high' },
        { y: 158, text: 'Spike: Redis caching layer', pri: 'med' },
        { y: 216, text: 'Document JWT exp handling', pri: 'low' },
    ];

    return (
        <svg viewBox="0 0 480 320" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
            <defs>
                <marker id="ai-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="rgba(190,148,96,0.6)" />
                </marker>
            </defs>

            {/* Canvas panel */}
            <rect x="16" y="16" width="174" height="290" rx="10"
                fill="rgba(190,148,96,0.03)" stroke="rgba(190,148,96,0.16)" strokeWidth="0.8" />
            <text x="28" y="34" fontSize="7" fill="rgba(190,148,96,0.4)" fontFamily="monospace" letterSpacing="1">CANVAS</text>

            {notes.map((n, i) => (
                <motion.g key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.55, delay: 0.1 + i * 0.1, ease: EASE }}
                >
                    <rect x="28" y={n.y} width="148" height="48" rx="6"
                        fill="rgba(190,148,96,0.05)" stroke="rgba(190,148,96,0.14)" strokeWidth="0.7" />
                    <text x="40" y={n.y + 19} fontSize="8" fill="rgba(237,228,208,0.68)" fontFamily="monospace"
                        style={{ wordSpacing: 1 }}>
                        {n.text.length > 20 ? n.text.slice(0, 20) + '…' : n.text}
                    </text>
                    <rect x="40" y={n.y + 26} width={n.tag.length * 5.2 + 8} height="12" rx="2.5"
                        fill={`${n.col}18`} stroke={`${n.col}40`} strokeWidth="0.5" />
                    <text x="44" y={n.y + 35} fontSize="6" fill={n.col} fontFamily="monospace">{n.tag}</text>
                </motion.g>
            ))}

            {/* AI processor — center */}
            <motion.g
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
                <rect x="202" y="126" width="76" height="68" rx="8"
                    fill="rgba(190,148,96,0.1)" stroke="rgba(190,148,96,0.45)" strokeWidth="0.9" />
                <text x="218" y="154" fontSize="8.5" fill="rgba(237,228,208,0.8)" fontFamily="monospace">intent</text>
                <text x="218" y="168" fontSize="8.5" fill="rgba(237,228,208,0.8)" fontFamily="monospace">layer</text>
                <text x="216" y="183" fontSize="6.5" fill="rgba(190,148,96,0.55)" fontFamily="monospace">AI · live</text>
            </motion.g>
            <line x1="190" y1="80" x2="215" y2="140"
                stroke="rgba(190,148,96,0.2)" strokeWidth="0.6" strokeDasharray="3 3" />
            <line x1="190" y1="160" x2="205" y2="160"
                stroke="rgba(190,148,96,0.2)" strokeWidth="0.6" strokeDasharray="3 3" />
            <line x1="190" y1="240" x2="215" y2="182"
                stroke="rgba(190,148,96,0.2)" strokeWidth="0.6" strokeDasharray="3 3" />

            {/* Arrow to task list */}
            <line x1="278" y1="160" x2="298" y2="160"
                stroke="rgba(190,148,96,0.45)" strokeWidth="0.8" markerEnd="url(#ai-arrow)" />

            {/* Task list panel */}
            <rect x="300" y="16" width="164" height="290" rx="10"
                fill="rgba(237,228,208,0.03)" stroke="rgba(237,228,208,0.1)" strokeWidth="0.8" />
            <text x="312" y="34" fontSize="7" fill="rgba(237,228,208,0.3)" fontFamily="monospace" letterSpacing="1">TASK LIST</text>

            {tasks.map((t, i) => (
                <motion.g key={i}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.55, delay: 0.35 + i * 0.1, ease: EASE }}
                >
                    <rect x="312" y={t.y} width="138" height="42" rx="5"
                        fill="rgba(237,228,208,0.03)" stroke="rgba(237,228,208,0.09)" strokeWidth="0.6" />
                    <rect x="322" y={t.y + 10} width="6" height="6" rx="1.5"
                        fill="none" stroke="rgba(190,148,96,0.45)" strokeWidth="0.7" />
                    <text x="334" y={t.y + 17} fontSize="7.5" fill="rgba(237,228,208,0.62)" fontFamily="monospace">
                        {t.text.length > 18 ? t.text.slice(0, 18) + '…' : t.text}
                    </text>
                    <rect x="322" y={t.y + 24} width={t.pri.length * 5 + 8} height="10" rx="2"
                        fill={t.pri === 'high' ? 'rgba(249,115,22,0.12)' : t.pri === 'med' ? 'rgba(251,191,36,0.1)' : 'rgba(190,148,96,0.08)'}
                        stroke={t.pri === 'high' ? 'rgba(249,115,22,0.3)' : t.pri === 'med' ? 'rgba(251,191,36,0.25)' : 'rgba(190,148,96,0.2)'}
                        strokeWidth="0.5"
                    />
                    <text x="326" y={t.y + 31.5} fontSize="6" fontFamily="monospace"
                        fill={t.pri === 'high' ? '#fdba74' : t.pri === 'med' ? '#fcd34d' : 'rgba(190,148,96,0.6)'}
                    >{t.pri}</text>
                </motion.g>
            ))}
        </svg>
    );
}

/* ── Pillar data ──────────────────────────────────────────────── */

const pillars = [
    {
        chapter: 'I',
        eyebrow: 'Sync',
        title: 'Two editors, one truth.',
        body1: "Most collaboration tools resolve conflict through luck — last write wins, or a human picks the winner. Ligma resolves it through math. Y.js's CRDT model treats every operation as a permanent, order-independent fact. Any two clients that exchange the same set of operations will converge to an identical state. Always.",
        body2: 'No version numbers. No conflict modals. No "someone else edited this" warnings. The canvas simply stays correct.',
        tags: ['Y.Doc', 'delta ops', 'convergence', 'WebSocket'],
        art: <CRDTArt />,
        flip: false,
    },
    {
        chapter: 'II',
        eyebrow: 'Permissions',
        title: 'Lock the node, not the document.',
        body1: "Document-level permissions are a blunt instrument. Either everyone can edit, or no one can. Real teams need something finer — the architecture decision node should be owner-only, the brainstorm cluster open to all, the payment config gated to seniors.",
        body2: 'Per-node ACL gives you exactly that. Each node carries its own permission record. Change it without touching anything else on the canvas.',
        tags: ['per-node ACL', 'role scope', 'owner / senior / viewer', 'JWT'],
        art: <ACLArt />,
        flip: true,
    },
    {
        chapter: 'III',
        eyebrow: 'Intelligence',
        title: 'The canvas reads itself.',
        body1: "The intent layer classifies every node as it's typed — action, decision, question, or reference — and assembles a live task board in the sidebar. When the meeting ends, the task list is already structured. No manual transcription, no Notion export, no slack message summarising what was agreed.",
        body2: 'You own the output. Approve, edit, or discard any item. The AI proposes; the team decides.',
        tags: ['intent classification', 'action · decision · question · ref', 'task board', 'per-room model'],
        art: <AIArt />,
        flip: false,
    },
];

/* ── Section ─────────────────────────────────────────────────── */

export default function Pillars() {
    return (
        <section id="features" className="relative bg-[#0b0906]">
            {/* Section header */}
            <div className="mx-auto w-full max-w-6xl px-6 pt-32 pb-24">
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.65, ease: EASE }}
                >
                    <h2
                        className="max-w-2xl font-poppins font-bold leading-[1.04] tracking-[-0.03em]"
                        style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', color: '#ede4d0' }}
                    >
                        What makes it work{' '}
                        <span
                            style={{
                                background: 'linear-gradient(90deg, #be9460 0%, #4a2510 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            differently.
                        </span>
                    </h2>
                </motion.div>
            </div>

            {/* Pillar rows */}
            <div className="flex flex-col">
                {pillars.map((p, i) => (
                    <div
                        key={p.chapter}
                        className="relative"
                        style={{
                            borderTop: '1px solid rgba(190,148,96,0.09)',
                        }}
                    >
                        <div className="mx-auto w-full max-w-6xl px-6 py-20">
                            <div
                                className={`grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-20 ${p.flip ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : ''}`}
                            >
                                {/* Text column */}
                                <motion.div
                                    initial={{ opacity: 0, y: 18 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: '-60px' }}
                                    transition={{ duration: 0.75, ease: EASE }}
                                    className="flex flex-col gap-6"
                                >
                                    {/* Title */}
                                    <h3
                                        className="font-poppins font-bold leading-[1.07] tracking-[-0.025em]"
                                        style={{
                                            fontSize: 'clamp(1.7rem, 3vw, 2.6rem)',
                                            color: '#ede4d0',
                                        }}
                                    >
                                        {p.title}
                                    </h3>

                                    {/* Body */}
                                    <p
                                        className="text-[0.97rem] leading-[1.84]"
                                        style={{ color: 'rgba(237,228,208,0.46)' }}
                                    >
                                        {p.body1}
                                    </p>
                                    <p
                                        className="text-[0.97rem] leading-[1.84]"
                                        style={{ color: 'rgba(237,228,208,0.38)' }}
                                    >
                                        {p.body2}
                                    </p>

                                    {/* Tag strip */}
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {p.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-full px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em]"
                                                style={{
                                                    background: 'rgba(190,148,96,0.07)',
                                                    border: '1px solid rgba(190,148,96,0.18)',
                                                    color: 'rgba(190,148,96,0.65)',
                                                }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </motion.div>

                                {/* Visual column */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true, margin: '-60px' }}
                                    transition={{ duration: 0.85, delay: 0.1, ease: EASE }}
                                    className="relative flex h-[340px] items-center justify-center overflow-hidden rounded-2xl"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(190,148,96,0.04) 0%, rgba(11,9,6,0.9) 60%)',
                                        border: '1px solid rgba(190,148,96,0.13)',
                                        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(190,148,96,0.08)',
                                    }}
                                >
                                    {/* Subtle grid inside visual panel */}
                                    <div
                                        aria-hidden
                                        className="pointer-events-none absolute inset-0 opacity-40"
                                        style={{
                                            backgroundImage:
                                                'linear-gradient(rgba(190,148,96,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.05) 1px, transparent 1px)',
                                            backgroundSize: '40px 40px',
                                        }}
                                    />
                                    <div className="relative z-10 h-full w-full p-6">
                                        {p.art}
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
