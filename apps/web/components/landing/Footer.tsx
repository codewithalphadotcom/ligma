import Link from 'next/link';

const cols = [
    {
        label: 'Product',
        links: [
            { name: 'Live demo', href: '/room/demo' },
            { name: 'Sign up', href: '/signup' },
            { name: 'Sign in', href: '/login' },
            { name: 'Dashboard', href: '/dashboard' },
        ],
    },
    {
        label: 'Engineering',
        links: [
            { name: 'CRDT engine', href: '#' },
            { name: 'Sync protocol', href: '#' },
            { name: 'Access model', href: '#' },
            { name: 'Changelog', href: '#' },
        ],
    },
    {
        label: 'Resources',
        links: [
            { name: 'Documentation', href: '#' },
            { name: 'API reference', href: '#' },
            { name: 'Status', href: '#' },
            { name: 'Support', href: '#' },
        ],
    },
];

export default function Footer() {
    return (
        <footer className="relative bg-[#0b0906]" style={{ borderTop: '1px solid rgba(190,148,96,0.12)' }}>
            <div className="mx-auto w-full max-w-7xl px-7 pt-20 pb-10">

                {/* Top — brand + columns */}
                <div className="grid grid-cols-1 gap-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-12">

                    {/* Brand block */}
                    <div className="flex flex-col gap-5">
                        <Link
                            href="/"
                            className="flex items-center gap-2.5 font-mono text-[18px] font-bold tracking-[0.3em] text-[#ede4d0] uppercase"
                        >
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#be9460]" />
                            Ligma
                        </Link>
                        <p
                            className="max-w-[300px] text-[0.9rem] leading-[1.7]"
                            style={{ color: 'rgba(237,228,208,0.4)' }}
                        >
                            An infinite shared canvas for teams who want to think together — with conflict-free sync, per-node access control, and an AI layer that turns decisions into work.
                        </p>

                        {/* Social icons */}
                        <div className="mt-2 flex items-center gap-4">
                            {/* GitHub */}
                            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub"
                                className="transition-opacity hover:opacity-100"
                                style={{ color: 'rgba(237,228,208,0.4)' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                </svg>
                            </a>
                            {/* X / Twitter */}
                            <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X"
                                className="transition-opacity hover:opacity-100"
                                style={{ color: 'rgba(237,228,208,0.4)' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L2.25 2.25h6.988l4.255 5.643 4.751-5.643zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                            {/* Instagram */}
                            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"
                                className="transition-opacity hover:opacity-100"
                                style={{ color: 'rgba(237,228,208,0.4)' }}
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                                </svg>
                            </a>
                            {/* LinkedIn */}
                            <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"
                                className="transition-opacity hover:opacity-100"
                                style={{ color: 'rgba(237,228,208,0.4)' }}
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Link columns */}
                    {cols.map((c) => (
                        <div key={c.label} className="flex flex-col gap-5">
                            <span
                                className="font-mono text-[10px] tracking-[0.3em] uppercase"
                                style={{ color: 'rgba(190,148,96,0.5)' }}
                            >
                                {c.label}
                            </span>
                            <div className="flex flex-col gap-3">
                                {c.links.map((l) => (
                                    <Link
                                        key={l.name}
                                        href={l.href}
                                        className="text-[14px] transition-colors hover:text-[#ede4d0]"
                                        style={{ color: 'rgba(237,228,208,0.55)' }}
                                    >
                                        {l.name}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Massive wordmark */}
                <div
                    aria-hidden
                    className="mt-24 mb-10 select-none overflow-hidden"
                >
                    <span
                        className="font-poppins block font-bold leading-[0.85] tracking-tighter"
                        style={{
                            fontSize: 'clamp(4.5rem, 18vw, 16rem)',
                            background:
                                'linear-gradient(180deg, rgba(190,148,96,0.16) 0%, rgba(190,148,96,0.02) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        LIGMA
                    </span>
                </div>

                {/* Bottom strip */}
                <div
                    className="flex flex-col items-start justify-between gap-5 pt-8 md:flex-row md:items-center"
                    style={{ borderTop: '1px solid rgba(190,148,96,0.08)' }}
                >
                    <span
                        className="font-mono text-[10.5px] tracking-[0.22em] uppercase"
                        style={{ color: 'rgba(190,148,96,0.35)' }}
                    >
                        © {new Date().getFullYear()} Ligma · Real-time collaborative canvas
                    </span>
                    <div className="flex items-center gap-7">
                        {[
                            { name: 'Privacy', href: '#' },
                            { name: 'Terms', href: '#' },
                            { name: 'Security', href: '#' },
                            { name: 'Contact', href: '#' },
                        ].map((l) => (
                            <Link
                                key={l.name}
                                href={l.href}
                                className="font-mono text-[10.5px] tracking-[0.22em] uppercase transition-colors hover:text-[#ede4d0]/85"
                                style={{ color: 'rgba(237,228,208,0.4)' }}
                            >
                                {l.name}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
