'use client';

/**
 * ClassificationLegend — small floating key that explains what each
 * classification badge color means. Rendered bottom-left of the canvas
 * so evaluators (and first-time users) can instantly map the colored
 * pills sitting above each note to their semantic meaning.
 *
 * Collapsible — opens on click, persists for the session. Defaults to
 * collapsed so it doesn't crowd the canvas chrome.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, ChevronDown } from 'lucide-react';

const ITEMS: Array<{
    label: string;
    sample: string;
    bg: string;
    fg: string;
    border: string;
    example: string;
}> = [
        {
            label: 'action',
            sample: 'ACTION',
            bg: 'rgba(249,115,22,0.18)',
            fg: '#fdba74',
            border: 'rgba(249,115,22,0.4)',
            example: '"fix the login bug before demo"',
        },
        {
            label: 'decision',
            sample: 'DECISION',
            bg: 'rgba(16,185,129,0.18)',
            fg: '#6ee7b7',
            border: 'rgba(16,185,129,0.4)',
            example: '"we decided to go with Supabase"',
        },
        {
            label: 'question',
            sample: 'QUESTION',
            bg: 'rgba(59,130,246,0.18)',
            fg: '#93c5fd',
            border: 'rgba(59,130,246,0.4)',
            example: '"should we use Redis for caching?"',
        },
        {
            label: 'reference',
            sample: 'REF',
            bg: 'rgba(168,85,247,0.18)',
            fg: '#d8b4fe',
            border: 'rgba(168,85,247,0.4)',
            example: '"see RFC 7519 §4.1.4 for exp claim"',
        },
    ];

const EASE = [0.32, 0.72, 0.3, 1] as const;

export function ClassificationLegend() {
    const [open, setOpen] = useState(false);

    return (
        <div
            data-canvas-chrome="legend"
            className="pointer-events-auto absolute bottom-4 right-4 z-30"
        >
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-[rgba(190,148,96,0.08)]"
                style={{
                    background: 'rgba(11,9,6,0.92)',
                    borderColor: 'rgba(190,148,96,0.32)',
                    color: '#ede4d0',
                    backdropFilter: 'blur(6px)',
                }}
                title="What do the colored pills mean?"
            >
                <Info size={13} />
                <span>Legend</span>
                <ChevronDown
                    size={12}
                    style={{
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms',
                    }}
                />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className="absolute bottom-full right-0 mb-2 w-72 rounded-lg border p-3 shadow-2xl"
                        style={{
                            background: 'rgba(11,9,6,0.96)',
                            borderColor: 'rgba(190,148,96,0.32)',
                            backdropFilter: 'blur(6px)',
                        }}
                    >
                        <div
                            className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: 'rgba(237,228,208,0.55)' }}
                        >
                            AI Intent Classification
                        </div>

                        <ul className="space-y-2">
                            {ITEMS.map((it) => (
                                <li key={it.label} className="flex items-start gap-2.5">
                                    <span
                                        className="mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                        style={{
                                            background: it.bg,
                                            color: it.fg,
                                            borderColor: it.border,
                                        }}
                                    >
                                        {it.sample}
                                    </span>
                                    <span
                                        className="text-[11px] leading-snug"
                                        style={{ color: 'rgba(237,228,208,0.78)' }}
                                    >
                                        {it.example}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div
                            className="mt-3 border-t pt-2 text-[10px] leading-relaxed"
                            style={{
                                borderColor: 'rgba(190,148,96,0.18)',
                                color: 'rgba(237,228,208,0.45)',
                            }}
                        >
                            Sticky notes & text blocks are auto-classified ~1.5s after
                            you stop typing. Action items are promoted to the Task
                            Board.
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
