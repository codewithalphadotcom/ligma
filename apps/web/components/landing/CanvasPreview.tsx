'use client';

import { motion } from 'framer-motion';

const EASE = [0.22, 0.1, 0.36, 1] as const;

/* ── Node box ────────────────────────────────────────────────── */

interface NodeBoxProps {
    title: string;
    sub?: string;
    dashed?: boolean;
    style: React.CSSProperties;
}

function NodeBox({ title, sub, dashed, style }: NodeBoxProps) {
    return (
        <div
            className="absolute flex flex-col justify-center gap-1 px-4 py-3"
            style={{
                borderRadius: '10px',
                border: `1px ${dashed ? 'dashed' : 'solid'} rgba(190,148,96,0.26)`,
                background: 'rgba(190,148,96,0.045)',
                backdropFilter: 'blur(4px)',
                zIndex: 2,
                ...style,
            }}
        >
            <p
                className="font-mono text-[11px] font-medium leading-tight"
                style={{ color: 'rgba(237,228,208,0.9)' }}
            >
                {title}
            </p>
            {sub && (
                <p className="font-mono text-[9px]" style={{ color: 'rgba(190,148,96,0.6)' }}>
                    {sub}
                </p>
            )}
        </div>
    );
}

/* ── Cursor ──────────────────────────────────────────────────── */

interface CursorProps {
    name: string;
    initX: string;
    initY: string;
    driftX: number[];
    driftY: number[];
    delay: number;
}

function Cursor({ name, initX, initY, driftX, driftY, delay }: CursorProps) {
    return (
        <motion.div
            aria-hidden
            className="pointer-events-none absolute z-20 flex items-center"
            style={{ left: initX, top: initY }}
            animate={{ x: driftX, y: driftY }}
            transition={{
                duration: 10,
                delay,
                repeat: Infinity,
                repeatType: 'mirror',
                ease: 'easeInOut',
            }}
        >
            {/* Cursor arrow */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                    d="M5 3L5 19L9 15L12 22L15 21L12 14L18 14Z"
                    fill="rgba(190,148,96,0.92)"
                    stroke="rgba(11,9,6,0.7)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                />
            </svg>
            {/* Name tag */}
            <span
                className="ml-1 rounded bg-[#be9460] px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-[#0b0906]"
            >
                {name}
            </span>
        </motion.div>
    );
}

/* ── Canvas preview card ─────────────────────────────────────── */

export default function CanvasPreview() {
    return (
        <div className="relative mx-auto w-full max-w-3xl">

            {/* Ambient glow */}
            <div
                aria-hidden
                className="pointer-events-none absolute -inset-12 opacity-100"
                style={{
                    background:
                        'radial-gradient(ellipse 75% 55% at 50% 50%, rgba(190,148,96,0.07) 0%, transparent 70%)',
                }}
            />

            {/* Card shell */}
            <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                    border: '1px solid rgba(190,148,96,0.16)',
                    background: 'linear-gradient(160deg, rgba(190,148,96,0.035) 0%, #0e0b08 55%)',
                    boxShadow:
                        '0 50px 100px -20px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(190,148,96,0.08) inset',
                }}
            >
                {/* ── Header ── */}
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
                            canvas · room/demo · live
                        </span>
                    </div>
                    <span
                        className="font-mono text-[9px] tracking-wider uppercase"
                        style={{ color: 'rgba(190,148,96,0.32)' }}
                    >
                        3 active
                    </span>
                </div>

                {/* ── Canvas area ── */}
                <div className="relative h-[390px] overflow-hidden">

                    {/* Inner grid — slightly warmer than bg */}
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(190,148,96,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.055) 1px, transparent 1px)',
                            backgroundSize: '44px 44px',
                        }}
                    />

                    {/* SVG connection lines */}
                    <svg
                        className="absolute inset-0 h-full w-full pointer-events-none"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        style={{ zIndex: 1 }}
                    >
                        {/* Node 1 → Node 2 */}
                        <line
                            x1="28" y1="14" x2="50" y2="11"
                            stroke="rgba(190,148,96,0.22)"
                            strokeWidth="0.35"
                            strokeDasharray="1.8 1.8"
                        />
                        {/* Node 2 → Node 4 */}
                        <line
                            x1="71" y1="11" x2="73" y2="30"
                            stroke="rgba(190,148,96,0.22)"
                            strokeWidth="0.35"
                            strokeDasharray="1.8 1.8"
                        />
                        {/* Node 4 → Node 3 */}
                        <line
                            x1="82" y1="42" x2="58" y2="55"
                            stroke="rgba(190,148,96,0.22)"
                            strokeWidth="0.35"
                            strokeDasharray="1.8 1.8"
                        />
                        {/* Node 3 → Node 5 */}
                        <line
                            x1="33" y1="58" x2="25" y2="68"
                            stroke="rgba(190,148,96,0.22)"
                            strokeWidth="0.35"
                            strokeDasharray="1.8 1.8"
                        />
                    </svg>

                    {/* ── Nodes ── */}
                    {/* Node 1: top-left */}
                    <NodeBox
                        title="Design review"
                        sub="3 open comments"
                        dashed
                        style={{ left: '5%', top: '8%', width: '22%', minWidth: '132px' }}
                    />
                    {/* Node 2: top-center-right */}
                    <NodeBox
                        title="API schema v2"
                        sub="alice · 2m ago"
                        style={{ left: '50%', top: '5%', width: '21%', minWidth: '132px' }}
                    />
                    {/* Node 3: mid-center */}
                    <NodeBox
                        title="Ship by friday?"
                        sub="↳ AI: 3 tasks"
                        dashed
                        style={{ left: '33%', top: '50%', width: '24%', minWidth: '140px' }}
                    />
                    {/* Node 4: right side */}
                    <NodeBox
                        title="Q3 roadmap"
                        sub="carol · 1m ago"
                        style={{ left: '72%', top: '28%', width: '21%', minWidth: '128px' }}
                    />
                    {/* Node 5: bottom-left */}
                    <NodeBox
                        title="User flows"
                        sub="bob · 8m ago"
                        dashed
                        style={{ left: '5%', top: '62%', width: '19%', minWidth: '120px' }}
                    />

                    {/* ── Cursors ── */}
                    <Cursor
                        name="alice"
                        initX="29%"
                        initY="5%"
                        driftX={[0, 14, -5, 10, 0]}
                        driftY={[0, 10, 20, -6, 0]}
                        delay={0.8}
                    />
                    <Cursor
                        name="ben"
                        initX="64%"
                        initY="60%"
                        driftX={[0, -10, 6, -16, 0]}
                        driftY={[0, 8, -5, 4, 0]}
                        delay={3.5}
                    />
                    <Cursor
                        name="carol"
                        initX="76%"
                        initY="20%"
                        driftX={[0, -8, 12, -4, 0]}
                        driftY={[0, 12, -8, 6, 0]}
                        delay={1.5}
                    />
                </div>

                {/* ── Footer ── */}
                <div
                    className="flex items-center justify-between overflow-x-auto px-5 py-3"
                    style={{ borderTop: '1px solid rgba(190,148,96,0.09)' }}
                >
                    <div className="flex items-center gap-7">
                        {['crdt · y.js', '∞ × ∞ canvas', 'rbac · per-node', '<100ms sync', 'ai · task layer'].map((s) => (
                            <span
                                key={s}
                                className="shrink-0 font-mono text-[9px] tracking-[0.22em] uppercase"
                                style={{ color: 'rgba(190,148,96,0.3)' }}
                            >
                                {s}
                            </span>
                        ))}
                    </div>
                    <span
                        className="shrink-0 font-mono text-[9px] tracking-[0.18em] uppercase"
                        style={{ color: 'rgba(190,148,96,0.2)' }}
                    >
                        3 online
                    </span>
                </div>
            </div>
        </div>
    );
}
