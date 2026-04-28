'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import Footer from '@/components/landing/Footer';

const RECENT_KEY = 'ligma:recentRooms';

interface RecentRoom {
    id: string;
    name: string;
    visitedAt: number;
}

interface RoomSummary {
    id: string;
    name: string;
    ownerId: string;
    createdAt: string;
    role: string;
}

function getRecentRooms(): RecentRoom[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentRoom[];
    } catch {
        return [];
    }
}

function saveRecentRoom(room: { id: string; name: string }): void {
    const rooms = getRecentRooms().filter((r) => r.id !== room.id);
    rooms.unshift({ ...room, visitedAt: Date.now() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(rooms.slice(0, 12)));
}

function timeAgo(iso: string | number): string {
    const t = typeof iso === 'string' ? new Date(iso).getTime() : iso;
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(t).toLocaleDateString();
}

const ROLE_BADGE: Record<string, { label: string; tone: string }> = {
    lead: { label: 'Lead', tone: '#be9460' },
    contributor: { label: 'Contributor', tone: 'rgba(237,228,208,0.7)' },
    viewer: { label: 'Viewer', tone: 'rgba(237,228,208,0.42)' },
};

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [roomName, setRoomName] = useState('');
    const [joinId, setJoinId] = useState('');
    const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
    const [recents, setRecents] = useState<RecentRoom[]>([]);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') router.replace('/login');
    }, [status, router]);

    useEffect(() => {
        setRecents(getRecentRooms());
        let cancel = false;
        api.listRooms()
            .then(({ rooms }) => {
                if (!cancel) setRooms(rooms);
            })
            .catch(() => {
                if (!cancel) setRooms([]);
            });
        return () => {
            cancel = true;
        };
    }, []);

    const userName = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? 'You';
    const initials = useMemo(() => {
        const src = session?.user?.name ?? session?.user?.email ?? 'U';
        return src
            .replace(/[^a-zA-Z\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]!.toUpperCase())
            .join('') || 'U';
    }, [session]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!roomName.trim()) return;
        setError('');
        setCreating(true);
        try {
            const { room } = await api.createRoom(roomName.trim());
            saveRecentRoom(room);
            router.push(`/room/${room.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create room');
            setCreating(false);
        }
    }

    async function handleJoin(e: React.FormEvent) {
        e.preventDefault();
        let id = joinId.trim();
        if (!id) return;
        const m = id.match(/\/room\/([^/?#]+)/);
        if (m) id = m[1]!;
        setError('');
        setJoining(true);
        try {
            const { room } = await api.joinRoom(id);
            saveRecentRoom(room);
            router.push(`/room/${room.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to join room');
            setJoining(false);
        }
    }

    function handleLogout() {
        void signOut({ callbackUrl: '/login' });
    }

    const ownedCount = rooms?.filter((r) => r.role === 'lead').length ?? 0;
    const totalCount = rooms?.length ?? 0;

    return (
        <>
            <div
                className="relative flex flex-1 flex-col bg-[#0b0906]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(190,148,96,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(190,148,96,0.05) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            >
                {/* ── Top bar ── */}
                <header
                    className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 lg:px-10"
                    style={{
                        borderBottom: '1px solid rgba(190,148,96,0.1)',
                        background: 'rgba(11,9,6,0.72)',
                        backdropFilter: 'blur(24px)',
                    }}
                >
                    <Link
                        href="/"
                        className="text-sm font-bold tracking-[0.18em]"
                        style={{ color: '#ede4d0' }}
                    >
                        LIGMA
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="hidden items-center gap-2.5 sm:flex">
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
                                style={{
                                    background: 'rgba(190,148,96,0.16)',
                                    border: '1px solid rgba(190,148,96,0.28)',
                                    color: '#be9460',
                                }}
                            >
                                {initials}
                            </div>
                            <span className="text-sm" style={{ color: 'rgba(237,228,208,0.62)' }}>
                                {userName}
                            </span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-sm transition hover:opacity-100"
                            style={{ color: 'rgba(237,228,208,0.42)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#be9460')}
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.color = 'rgba(237,228,208,0.42)')
                            }
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 lg:px-10 lg:py-16">
                    {/* ── Hero strip ── */}
                    <section className="mb-12">
                        <p
                            className="font-mono text-[10px] tracking-[0.28em] uppercase"
                            style={{ color: 'rgba(190,148,96,0.55)' }}
                        >
                            Workspace
                        </p>
                        <h1
                            className="mt-3 font-bold leading-[1.05] tracking-[-0.03em]"
                            style={{
                                fontSize: 'clamp(2.1rem, 3.4vw, 2.85rem)',
                                color: '#ede4d0',
                            }}
                        >
                            Welcome back, <span style={{ color: '#be9460' }}>{userName}</span>.
                        </h1>
                        <p
                            className="mt-3 max-w-xl text-[0.95rem] leading-[1.7]"
                            style={{ color: 'rgba(237,228,208,0.42)' }}
                        >
                            Spin up a new canvas, jump into an existing room, or revisit a recent
                            session. Every room stays in continuous sync — no merges, no losses.
                        </p>

                        <div className="mt-8 grid grid-cols-3 gap-3 sm:max-w-md">
                            <StatCard
                                value={rooms === null ? '—' : String(totalCount)}
                                label="rooms"
                            />
                            <StatCard
                                value={rooms === null ? '—' : String(ownedCount)}
                                label="owned"
                            />
                            <StatCard
                                value={rooms === null ? '—' : String(totalCount - ownedCount)}
                                label="joined"
                            />
                        </div>
                    </section>

                    {/* ── Action cards ── */}
                    <section className="mb-14 grid gap-5 lg:grid-cols-2">
                        <Card>
                            <CardHeader
                                eyebrow="New session"
                                title="Create a room"
                                desc="A blank infinite canvas. You'll be the lead."
                            />
                            <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3">
                                <Input
                                    value={roomName}
                                    onChange={setRoomName}
                                    placeholder="e.g. Roadmap planning Q3"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={creating || !roomName.trim()}
                                    className="w-full rounded-xl py-2.5 text-[0.9rem] font-semibold transition hover:opacity-90 disabled:opacity-40"
                                    style={{ background: '#ede4d0', color: '#0b0906' }}
                                >
                                    {creating ? 'Creating…' : 'Create room  →'}
                                </button>
                            </form>
                        </Card>

                        <Card>
                            <CardHeader
                                eyebrow="Existing"
                                title="Join a room"
                                desc="Paste a room ID or share link from a teammate."
                            />
                            <form onSubmit={handleJoin} className="mt-6 flex flex-col gap-3">
                                <Input
                                    value={joinId}
                                    onChange={setJoinId}
                                    placeholder="room-id  or  https://…/room/abc"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={joining || !joinId.trim()}
                                    className="w-full rounded-xl py-2.5 text-[0.9rem] font-semibold transition disabled:opacity-40"
                                    style={{
                                        background: 'rgba(190,148,96,0.08)',
                                        border: '1px solid rgba(190,148,96,0.28)',
                                        color: '#ede4d0',
                                    }}
                                    onMouseEnter={(e) =>
                                        (e.currentTarget.style.background =
                                            'rgba(190,148,96,0.14)')
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.background =
                                            'rgba(190,148,96,0.08)')
                                    }
                                >
                                    {joining ? 'Joining…' : 'Join room  →'}
                                </button>
                            </form>
                        </Card>

                        {error && (
                            <p
                                className="lg:col-span-2 rounded-lg px-4 py-2.5 text-[0.85rem]"
                                style={{
                                    background: 'rgba(180,50,50,0.1)',
                                    border: '1px solid rgba(180,50,50,0.22)',
                                    color: 'rgba(237,160,160,0.9)',
                                }}
                            >
                                {error}
                            </p>
                        )}
                    </section>

                    {/* ── Your rooms ── */}
                    <section className="mb-12">
                        <SectionHeader
                            eyebrow="All rooms"
                            title="Your rooms"
                            count={rooms?.length}
                        />
                        {rooms === null ? (
                            <RoomGridSkeleton />
                        ) : rooms.length === 0 ? (
                            <EmptyState
                                title="No rooms yet"
                                desc="Create your first room above to start collaborating."
                            />
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {rooms.map((r) => (
                                    <RoomCard
                                        key={r.id}
                                        room={r}
                                        onClick={() => {
                                            saveRecentRoom({ id: r.id, name: r.name });
                                            router.push(`/room/${r.id}`);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* ── Recent ── */}
                    {recents.length > 0 && (
                        <section className="mb-8">
                            <SectionHeader eyebrow="History" title="Recently visited" />
                            <div
                                className="overflow-hidden rounded-2xl"
                                style={{
                                    border: '1px solid rgba(237,228,208,0.07)',
                                    background: 'rgba(11,9,6,0.38)',
                                    backdropFilter: 'blur(24px)',
                                }}
                            >
                                {recents.map((r, i) => (
                                    <Link
                                        key={r.id}
                                        href={`/room/${r.id}`}
                                        className="flex items-center justify-between px-5 py-3.5 transition"
                                        style={{
                                            borderTop:
                                                i === 0
                                                    ? 'none'
                                                    : '1px solid rgba(190,148,96,0.07)',
                                        }}
                                        onMouseEnter={(e) =>
                                            (e.currentTarget.style.background =
                                                'rgba(190,148,96,0.05)')
                                        }
                                        onMouseLeave={(e) =>
                                            (e.currentTarget.style.background = 'transparent')
                                        }
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-2 w-2 rounded-full"
                                                style={{ background: '#be9460' }}
                                            />
                                            <span
                                                className="text-[0.92rem] font-medium"
                                                style={{ color: '#ede4d0' }}
                                            >
                                                {r.name}
                                            </span>
                                        </div>
                                        <div
                                            className="flex items-center gap-4 font-mono text-[11px]"
                                            style={{ color: 'rgba(237,228,208,0.32)' }}
                                        >
                                            <span>{timeAgo(r.visitedAt)}</span>
                                            <span style={{ color: 'rgba(237,228,208,0.22)' }}>
                                                {r.id.slice(0, 8)}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </main>
            </div>
            <Footer />
        </>
    );
}

/* ── presentational primitives ── */

function StatCard({ value, label }: { value: string; label: string }) {
    return (
        <div
            className="flex flex-col gap-1 rounded-xl px-4 py-3"
            style={{
                border: '1px solid rgba(190,148,96,0.1)',
                background: 'rgba(190,148,96,0.03)',
            }}
        >
            <span
                className="text-[1.4rem] font-bold leading-none tracking-tight"
                style={{ color: '#be9460' }}
            >
                {value}
            </span>
            <span
                className="font-mono text-[10px] tracking-[0.18em] uppercase"
                style={{ color: 'rgba(237,228,208,0.36)' }}
            >
                {label}
            </span>
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-2xl px-7 py-7"
            style={{
                border: '1px solid rgba(237,228,208,0.07)',
                background: 'rgba(11,9,6,0.38)',
                backdropFilter: 'blur(36px)',
                boxShadow:
                    '0 0 0 1px rgba(190,148,96,0.05), 0 24px 60px rgba(0,0,0,0.32)',
            }}
        >
            {children}
        </div>
    );
}

function CardHeader({
    eyebrow,
    title,
    desc,
}: {
    eyebrow: string;
    title: string;
    desc: string;
}) {
    return (
        <>
            <p
                className="font-mono text-[10px] tracking-[0.24em] uppercase"
                style={{ color: 'rgba(190,148,96,0.55)' }}
            >
                {eyebrow}
            </p>
            <h2
                className="mt-2 text-[1.25rem] font-bold tracking-tight"
                style={{ color: '#ede4d0' }}
            >
                {title}
            </h2>
            <p
                className="mt-1.5 text-[0.85rem] leading-[1.6]"
                style={{ color: 'rgba(237,228,208,0.42)' }}
            >
                {desc}
            </p>
        </>
    );
}

function Input({
    value,
    onChange,
    placeholder,
    required,
    type = 'text',
    inputMode,
    maxLength,
    autoFocus,
    autoComplete,
    pattern,
    className,
    onKeyDown,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
    type?: string;
    inputMode?: 'text' | 'numeric' | 'email';
    maxLength?: number;
    autoFocus?: boolean;
    autoComplete?: string;
    pattern?: string;
    className?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
    return (
        <input
            type={type}
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            maxLength={maxLength}
            autoFocus={autoFocus}
            autoComplete={autoComplete}
            pattern={pattern}
            onKeyDown={onKeyDown}
            className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors placeholder:opacity-30 ${className ?? ''}`}
            style={{
                background: 'rgba(190,148,96,0.04)',
                border: '1px solid rgba(190,148,96,0.16)',
                color: '#ede4d0',
            }}
            onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'rgba(190,148,96,0.48)')
            }
            onBlur={(e) =>
                (e.currentTarget.style.borderColor = 'rgba(190,148,96,0.16)')
            }
        />
    );
}

function SectionHeader({
    eyebrow,
    title,
    count,
}: {
    eyebrow: string;
    title: string;
    count?: number;
}) {
    return (
        <div className="mb-5 flex items-end justify-between">
            <div>
                <p
                    className="font-mono text-[10px] tracking-[0.24em] uppercase"
                    style={{ color: 'rgba(190,148,96,0.55)' }}
                >
                    {eyebrow}
                </p>
                <h2
                    className="mt-1.5 text-[1.4rem] font-bold tracking-tight"
                    style={{ color: '#ede4d0' }}
                >
                    {title}
                </h2>
            </div>
            {typeof count === 'number' && count > 0 && (
                <span
                    className="font-mono text-[11px] tracking-wider"
                    style={{ color: 'rgba(237,228,208,0.32)' }}
                >
                    {count} {count === 1 ? 'room' : 'rooms'}
                </span>
            )}
        </div>
    );
}

function RoomCard({ room, onClick }: { room: RoomSummary; onClick: () => void }) {
    const badge = ROLE_BADGE[room.role] ?? ROLE_BADGE.contributor!;
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex flex-col items-start rounded-2xl px-5 py-5 text-left transition-all"
            style={{
                border: '1px solid rgba(237,228,208,0.07)',
                background: 'rgba(11,9,6,0.38)',
                backdropFilter: 'blur(24px)',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(190,148,96,0.32)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(237,228,208,0.07)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            <div className="flex w-full items-start justify-between gap-3">
                <h3
                    className="line-clamp-2 text-[1rem] font-semibold leading-snug tracking-tight"
                    style={{ color: '#ede4d0' }}
                >
                    {room.name}
                </h3>
                <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                    style={{
                        border: `1px solid ${badge.tone}`,
                        color: badge.tone,
                    }}
                >
                    {badge.label}
                </span>
            </div>
            <div
                className="mt-5 flex w-full items-center justify-between font-mono text-[11px]"
                style={{ color: 'rgba(237,228,208,0.32)' }}
            >
                <span>{room.id.slice(0, 10)}</span>
                <span>{timeAgo(room.createdAt)}</span>
            </div>
        </button>
    );
}

function RoomGridSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="h-[122px] rounded-2xl"
                    style={{
                        border: '1px solid rgba(237,228,208,0.05)',
                        background:
                            'linear-gradient(110deg, rgba(190,148,96,0.04) 0%, rgba(190,148,96,0.08) 50%, rgba(190,148,96,0.04) 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'ligma-shimmer 1.6s ease-in-out infinite',
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes ligma-shimmer {
                    0% {
                        background-position: 100% 0;
                    }
                    100% {
                        background-position: -100% 0;
                    }
                }
            `}</style>
        </div>
    );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
    return (
        <div
            className="flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center"
            style={{
                border: '1px dashed rgba(190,148,96,0.18)',
                background: 'rgba(190,148,96,0.02)',
            }}
        >
            <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                    border: '1px solid rgba(190,148,96,0.22)',
                    background: 'rgba(190,148,96,0.08)',
                }}
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#be9460"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M12 8v8M8 12h8" />
                </svg>
            </div>
            <h3 className="text-[1.05rem] font-semibold" style={{ color: '#ede4d0' }}>
                {title}
            </h3>
            <p
                className="mt-1.5 text-[0.85rem]"
                style={{ color: 'rgba(237,228,208,0.42)' }}
            >
                {desc}
            </p>
        </div>
    );
}
