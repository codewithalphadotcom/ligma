'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

const links = [
    { id: 'showcase', label: 'Use cases' },
    { id: 'process', label: 'How it works' },
    { id: 'manifesto', label: 'Principles' },
];

function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Nav() {
    const { status } = useSession();
    const authed = status === 'authenticated';

    return (
        <header className="sticky top-0 z-50 bg-[#0b0906]/80 backdrop-blur-xl">
            <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between px-7">

                {/* Brand */}
                <Link
                    href="/"
                    className="flex items-center gap-2.5 font-mono text-[18px] font-bold tracking-[0.3em] text-[#ede4d0] uppercase"
                >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#be9460]" />
                    Ligma
                </Link>

                {/* Center nav */}
                <nav className="hidden items-center gap-9 md:flex">
                    {links.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => scrollTo(l.id)}
                            className="text-[15px] text-[#ede4d0]/50 transition-colors hover:text-[#ede4d0] cursor-pointer bg-transparent border-none p-0"
                        >
                            {l.label}
                        </button>
                    ))}
                </nav>

                {/* Right CTAs — auth-aware. When signed in we collapse to a
                    single "Dashboard" pill (the secondary "sign in" link is
                    redundant once you're already in). */}
                <div className="flex items-center gap-2">
                    {authed ? (
                        <Link
                            href="/dashboard"
                            className="rounded-xl bg-[#ede4d0] px-5 py-2 text-[15px] font-semibold text-[#0b0906] transition-all hover:bg-[#d8ceb8]"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="rounded-xl px-4 py-2 text-[15px] text-[#ede4d0]/60 transition-colors hover:bg-[#be9460]/8 hover:text-[#ede4d0]"
                            >
                                Sign in
                            </Link>
                            <Link
                                href="/signup"
                                className="rounded-xl bg-[#ede4d0] px-5 py-2 text-[15px] font-semibold text-[#0b0906] transition-all hover:bg-[#d8ceb8]"
                            >
                                Get started
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
