'use client';

import { motion } from 'framer-motion';

const EASE = [0.22, 0.1, 0.36, 1] as const;

const features = [
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
                <circle cx="12" cy="12" r="9" strokeDasharray="2 2.5" />
            </svg>
        ),
        label: 'Live cursors',
        body: "Every collaborator's cursor, name, and selection state propagates in real time. No polling. No stale presence.",
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3L3 8l9 5 9-5-9-5z" />
                <path d="M3 16l9 5 9-5" />
                <path d="M3 12l9 5 9-5" />
            </svg>
        ),
        label: 'Infinite canvas',
        body: 'Pan and zoom freely. Nodes, connectors, text — arranged however your thinking demands, at any scale.',
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
        label: 'Per-node ACL',
        body: 'Lock individual nodes to specific roles. Leave the rest open. Granular permissions at the data level, not the document level.',
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
        ),
        label: 'Conflict-free CRDT',
        body: 'Y.js resolves simultaneous edits at the data structure level. No version conflicts, no save button, no merge step ever.',
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
        ),
        label: 'AI intent layer',
        body: 'An AI layer reads nodes and discussions, proposes a structured task list, and updates it as the canvas evolves.',
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
            </svg>
        ),
        label: 'Session replay',
        body: 'Scrub through the full history of a canvas session. See who moved what, and when every decision was made.',
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
        label: 'Room-based access',
        body: 'Share a URL. Anyone with the link joins the room. No workspace provisioning, no seat licenses, no admin queue.',
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8m-4-4v4" />
            </svg>
        ),
        label: 'Canvas preview',
        body: 'Every room generates a live thumbnail. Browse your canvases from the dashboard without opening a single one.',
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
                <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
                <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
                <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
                <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
                <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z" />
                <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z" />
            </svg>
        ),
        label: 'Task board',
        body: 'AI-classified nodes surface in a live task board alongside the canvas. Open items, owners, and status — all from the same room.',
    },
];

export default function Features() {
    return (
        <section id="features" className="relative bg-[#0b0906]">
            <div className="mx-auto w-full max-w-6xl px-6 py-32">

                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.65, ease: EASE }}
                    className="mb-20 flex flex-col gap-5"
                >
                    <span
                        className="font-mono text-[10.5px] uppercase tracking-[0.32em]"
                        style={{ color: 'rgba(190,148,96,0.6)' }}
                    >
                        Everything you get
                    </span>
                    <h2
                        className="font-poppins font-bold leading-[1.05] tracking-[-0.03em]"
                        style={{
                            fontSize: 'clamp(2rem, 4vw, 3.4rem)',
                            color: '#ede4d0',
                            maxWidth: '680px',
                        }}
                    >
                        Built for teams who move{' '}
                        <span
                            style={{
                                background: 'linear-gradient(90deg, #be9460 0%, #4a2510 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            fast.
                        </span>
                    </h2>
                    <p
                        className="max-w-[560px] text-[1rem] leading-[1.78]"
                        style={{ color: 'rgba(237,228,208,0.44)' }}
                    >
                        From real-time sync to AI task extraction — every capability is designed around the way thinking actually happens, not how project management software wishes it did.
                    </p>
                </motion.div>

                {/* Feature grid */}
                <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((f, i) => (
                        <motion.div
                            key={f.label}
                            initial={{ opacity: 0, y: 18 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.6, delay: (i % 3) * 0.07, ease: EASE }}
                            className="group flex flex-col gap-4 p-8 transition-colors duration-200"
                            style={{
                                border: '1px solid rgba(190,148,96,0.1)',
                                background: 'rgba(190,148,96,0.025)',
                                margin: '-0.5px',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(190,148,96,0.055)';
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(190,148,96,0.22)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(190,148,96,0.025)';
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(190,148,96,0.1)';
                            }}
                        >
                            <div
                                className="flex h-9 w-9 items-center justify-center rounded-lg"
                                style={{
                                    background: 'rgba(190,148,96,0.1)',
                                    color: '#be9460',
                                    border: '1px solid rgba(190,148,96,0.2)',
                                }}
                            >
                                {f.icon}
                            </div>
                            <h3
                                className="font-poppins text-[1.05rem] font-semibold leading-snug tracking-[-0.01em]"
                                style={{ color: '#ede4d0' }}
                            >
                                {f.label}
                            </h3>
                            <p
                                className="text-[0.9rem] leading-[1.72]"
                                style={{ color: 'rgba(237,228,208,0.46)' }}
                            >
                                {f.body}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
