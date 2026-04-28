'use client';

import { motion } from 'framer-motion';

const EASE = [0.22, 0.1, 0.36, 1] as const;

const principles = [
    {
        n: 'I',
        title: 'The room is the unit.',
        body:
            'Most tools start with the workspace and bury the work. We start with the room. Each canvas is a self-contained piece of context — its own permissions, its own history, its own URL. The team forms around the work, not the other way around.',
    },
    {
        n: 'II',
        title: 'Conflict is a data structure problem.',
        body:
            'Locking, last-write-wins, manual merges — these are workarounds for tools that were never designed for simultaneity. We chose CRDTs because the math is honest: when two people edit at the same time, both edits are real, and the structure should know how to keep them.',
    },
    {
        n: 'III',
        title: 'Permissions belong on the node.',
        body:
            'A document-level role model is too coarse. The senior architect should be able to lock a single decision node while leaving the rest of the canvas open. Per-node access control is not a feature — it is a position on what trust between collaborators actually means.',
    },
    {
        n: 'IV',
        title: 'AI assists, never authors.',
        body:
            'The AI layer reads the canvas. It proposes a structured task list. It does not write your decisions for you, and it does not replace the discussion. The team remains the source of truth; the model is just a fast, careful reader.',
    },
];

export default function Manifesto() {
    return (
        <section id="manifesto" className="relative bg-[#0b0906]">


            <div className="relative mx-auto w-full max-w-6xl px-6 py-32">

                <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr_1.4fr] lg:gap-24">

                    {/* Left rail — sticky title */}
                    <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.75, ease: EASE }}
                        className="flex flex-col gap-7 lg:sticky lg:top-32 lg:self-start"
                    >
                        <h2
                            className="font-poppins font-bold leading-[1.02] tracking-[-0.035em]"
                            style={{
                                fontSize: 'clamp(2.2rem, 4.4vw, 3.8rem)',
                                color: '#ede4d0',
                            }}
                        >
                            Four convictions{' '}
                            <span
                                style={{
                                    background:
                                        'linear-gradient(90deg, #be9460 0%, #4a2510 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}
                            >
                                we shipped on.
                            </span>
                        </h2>
                        <p
                            className="text-[0.95rem] leading-[1.78]"
                            style={{ color: 'rgba(237,228,208,0.42)' }}
                        >
                            Ligma is not a generic whiteboard. It encodes a specific opinion about how teams should think together — what should be fast, what should be local, what should be permissioned, and where the AI belongs.
                        </p>


                    </motion.div>

                    {/* Right — principles */}
                    <div className="flex flex-col gap-14">
                        {principles.map((p, i) => (
                            <motion.article
                                key={p.n}
                                initial={{ opacity: 0, y: 22 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-50px' }}
                                transition={{ duration: 0.8, delay: i * 0.06, ease: EASE }}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex items-baseline gap-5">
                                    <span
                                        className="font-poppins font-bold leading-none"
                                        style={{
                                            fontSize: '1.6rem',
                                            color: 'rgba(190,148,96,0.55)',
                                            letterSpacing: '0.06em',
                                            minWidth: '36px',
                                        }}
                                    >
                                        {p.n}
                                    </span>
                                    <h3
                                        className="font-poppins font-bold leading-[1.18] tracking-[-0.02em]"
                                        style={{
                                            fontSize: 'clamp(1.3rem, 2vw, 1.7rem)',
                                            color: '#ede4d0',
                                        }}
                                    >
                                        {p.title}
                                    </h3>
                                </div>
                                <p
                                    className="pl-[56px] text-[1rem] leading-[1.78]"
                                    style={{ color: 'rgba(237,228,208,0.5)' }}
                                >
                                    {p.body}
                                </p>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
