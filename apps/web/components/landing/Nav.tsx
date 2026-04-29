'use client';

/**
 * Nav — landing-page header, ported from the Cognix project's
 * `components/layout/header.tsx` and adapted for Ligma:
 *  - Ligma's dark/wood palette (#0b0906 / #ede4d0 / #be9460) instead of
 *    shadcn's `bg-background` / `text-foreground` tokens.
 *  - No `@/components/ui/button` dep (that dir is empty here) — anchor
 *    elements are styled directly.
 *  - Menu items mix in-page anchor scrolls (single-page landing) with
 *    real routes (/dashboard).
 *  - Auth-aware right CTA via NextAuth's `useSession`: signed-in users
 *    see "Dashboard"; everyone else sees "Sign in" + "Get started".
 *  - Same shrink-on-scroll behaviour: pill rounds, max-width tightens,
 *    background blurs once user scrolls past 50px.
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type MenuItem = { name: string; href: string; anchor?: string };

const menuItems: MenuItem[] = [
    { name: 'Use cases', href: '/#showcase', anchor: 'showcase' },
    { name: 'How it works', href: '/#process', anchor: 'process' },
    { name: 'Principles', href: '/#manifesto', anchor: 'manifesto' },
];

function smoothScrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Nav() {
    const { data: session } = useSession();
    const [menuState, setMenuState] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header>
            <nav
                data-state={menuState ? 'active' : undefined}
                className="group fixed top-0 z-50 w-full px-2"
            >
                <div
                    className={cn(
                        // Default: contained pill, transparent, NO border / NO bg.
                        'mx-auto mt-3 max-w-5xl rounded-2xl border border-transparent px-6 transition-all duration-300 lg:px-10',
                        // Scrolled: tighter, glassmorphic — translucent bg, soft
                        // border, blur. Keeps the rounded corners from default
                        // so the transition is purely color/width/border.
                        scrolled &&
                            'max-w-4xl border-[#be9460]/15 bg-[#0b0906]/55 shadow-lg shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl backdrop-saturate-150 lg:px-5',
                    )}
                >
                    <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
                        {/* Logo */}
                        <div className="flex w-full justify-between lg:w-auto">
                            <Link
                                href="/"
                                aria-label="home"
                                onClick={(e) => {
                                    if (window.location.pathname === '/') {
                                        e.preventDefault();
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }
                                }}
                                className="flex cursor-pointer items-center"
                            >
                                <span className="font-mono text-[18px] font-bold uppercase tracking-[0.3em] text-[#ede4d0]">
                                    Ligma
                                </span>
                            </Link>

                            {/* Mobile menu toggle */}
                            <button
                                type="button"
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 text-[#ede4d0] lg:hidden"
                            >
                                <Menu className="m-auto size-6 duration-200 group-data-[state=active]:scale-0 group-data-[state=active]:rotate-180 group-data-[state=active]:opacity-0" />
                                <X className="absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200 group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100" />
                            </button>
                        </div>

                        {/* Desktop Navigation - centered */}
                        <div className="absolute inset-0 m-auto hidden size-fit lg:block">
                            <ul className="flex gap-8 text-md">
                                {menuItems.map((item) => (
                                    <li key={item.name}>
                                        {item.anchor ? (
                                            <button
                                                type="button"
                                                onClick={() => smoothScrollTo(item.anchor!)}
                                                className="block cursor-pointer border-none bg-transparent p-0 font-medium text-[#ede4d0]/55 duration-150 hover:text-[#ede4d0]"
                                            >
                                                {item.name}
                                            </button>
                                        ) : (
                                            <Link
                                                href={item.href}
                                                className="block cursor-pointer font-medium text-[#ede4d0]/55 duration-150 hover:text-[#ede4d0]"
                                            >
                                                {item.name}
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Mobile menu drawer + CTA buttons */}
                        <div className="mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border border-[#be9460]/20 bg-[#0b0906] p-6 shadow-2xl shadow-black/40 group-data-[state=active]:block md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none lg:group-data-[state=active]:flex">
                            {/* Mobile nav list */}
                            <div className="lg:hidden">
                                <ul className="space-y-6 text-base">
                                    {menuItems.map((item) => (
                                        <li key={item.name}>
                                            {item.anchor ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setMenuState(false);
                                                        smoothScrollTo(item.anchor!);
                                                    }}
                                                    className="block cursor-pointer border-none bg-transparent p-0 text-[#ede4d0]/60 duration-150 hover:text-[#ede4d0]"
                                                >
                                                    {item.name}
                                                </button>
                                            ) : (
                                                <Link
                                                    href={item.href}
                                                    onClick={() => setMenuState(false)}
                                                    className="block cursor-pointer text-[#ede4d0]/60 duration-150 hover:text-[#ede4d0]"
                                                >
                                                    {item.name}
                                                </Link>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Action buttons */}
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                                {session ? (
                                    <Link
                                        href="/dashboard"
                                        aria-label="Open dashboard"
                                        className={cn(
                                            'rounded-xl bg-[#ede4d0] px-5 py-2 text-center text-[14px] font-semibold text-[#0b0906] transition-all duration-300 hover:bg-[#d8ceb8]',
                                            !scrolled && 'min-w-[100px]',
                                        )}
                                    >
                                        Dashboard
                                    </Link>
                                ) : (
                                    <>
                                        {!scrolled && (
                                            <Link
                                                href="/login"
                                                aria-label="Sign in"
                                                className="rounded-xl border border-[#be9460]/25 px-4 py-2 text-center text-[14px] font-medium text-[#ede4d0]/75 transition-all duration-300 hover:border-[#be9460]/50 hover:text-[#ede4d0]"
                                            >
                                                Sign in
                                            </Link>
                                        )}
                                        <Link
                                            href="/signup"
                                            aria-label="Get started"
                                            className={cn(
                                                'rounded-xl bg-[#ede4d0] px-5 py-2 text-center text-[14px] font-semibold text-[#0b0906] transition-all duration-300 hover:bg-[#d8ceb8]',
                                                !scrolled && 'min-w-[80px]',
                                            )}
                                        >
                                            Get started
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

        </header>
    );
}
