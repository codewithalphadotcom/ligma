'use client';

/**
 * MembersSidebar — top-left toggle that opens a slide-in left panel listing
 * room members.
 *
 * Behaviour:
 *  - Authenticated, server-backed rooms: fetches `GET /rooms/:id` and shows
 *    every member that has ever joined, with a live-presence dot derived from
 *    Y.Awareness. The Lead can change anyone's role through an inline select
 *    (server enforces the same rule via `PATCH /rooms/:id/members`).
 *  - Demo / unauthenticated sessions: the API call fails so we fall back to
 *    showing only currently-live participants by name (no role chrome).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { Users, X, Crown, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { UserPresence } from '@/lib/types';

type Role = 'lead' | 'contributor' | 'viewer';

interface ServerMember {
    id: string;
    name: string;
    email: string;
    color: string;
    role: Role;
}

interface MembersSidebarProps {
    roomId: string;
    selfId: string;
    selfName: string;
    selfColor: string;
    presence: Map<number, UserPresence>;
    /**
     * Room-level metadata Y.Map. The Lead bumps `membersVersion` here after
     * every successful role PATCH; every other client (including the
     * affected member) observes the bump and refetches the member list,
     * making role changes propagate in real time without a page refresh.
     */
    meta: Y.Map<unknown>;
}

const ROLE_LABEL: Record<Role, string> = {
    lead: 'Lead',
    contributor: 'Contributor',
    viewer: 'Viewer',
};

const ROLE_DOT: Record<Role, string> = {
    lead: '#be9460',
    contributor: 'rgba(237,228,208,0.7)',
    viewer: 'rgba(237,228,208,0.42)',
};

export function MembersSidebar({
    roomId,
    selfId,
    selfName,
    selfColor,
    presence,
    meta,
}: MembersSidebarProps) {
    const [open, setOpen] = useState(false);
    const [members, setMembers] = useState<ServerMember[] | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Fetch member list once when the sidebar is first opened. If the call
    // fails (demo room / guest session) we stay in awareness-only mode.
    useEffect(() => {
        if (!open || loaded) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await api.getRoom(roomId);
                if (!cancelled) setMembers(res.members);
            } catch {
                if (!cancelled) setMembers(null);
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, loaded, roomId]);

    // Real-time refresh: whenever any Lead bumps `meta.membersVersion`,
    // refetch the authoritative member list. Runs as long as the sidebar
    // has been opened at least once (so we don't pull data the user never
    // looked at). Self-bumps are also observed — harmless and keeps the
    // optimistic state perfectly aligned with the DB.
    useEffect(() => {
        if (!loaded) return;
        function onMetaChange(e: Y.YMapEvent<unknown>) {
            if (!e.keysChanged.has('membersVersion')) return;
            (async () => {
                try {
                    const res = await api.getRoom(roomId);
                    setMembers(res.members);
                } catch {
                    /* leave existing list as-is on transient failure */
                }
            })();
        }
        meta.observe(onMetaChange);
        return () => meta.unobserve(onMetaChange);
    }, [loaded, meta, roomId]);

    // Set of authorIds who are currently broadcasting awareness state.
    const liveIds = useMemo(() => {
        const ids = new Set<string>([selfId]);
        presence.forEach((p) => {
            if (p.user?.id) ids.add(p.user.id);
        });
        return ids;
    }, [presence, selfId]);

    // Derive caller's role from server data (truthful) instead of the
    // localStorage debug toggle. Falls back to 'contributor' when unknown.
    const selfRole: Role | null = useMemo(() => {
        if (!members) return null;
        return members.find((m) => m.id === selfId)?.role ?? null;
    }, [members, selfId]);

    const isLead = selfRole === 'lead';

    // Awareness-only fallback: build a synthetic list of currently-live users.
    const liveOnlyMembers = useMemo(() => {
        const list: { id: string; name: string; color: string; isSelf: boolean }[] = [
            { id: selfId, name: selfName || 'You', color: selfColor, isSelf: true },
        ];
        const seen = new Set<string>([selfId]);
        presence.forEach((p) => {
            if (!p.user) return;
            if (seen.has(p.user.id)) return;
            seen.add(p.user.id);
            list.push({
                id: p.user.id,
                name: p.user.name || 'Guest',
                color: p.user.color || '#737373',
                isSelf: false,
            });
        });
        return list;
    }, [presence, selfId, selfName, selfColor]);

    const handleRoleChange = useCallback(
        async (userId: string, role: Role) => {
            setError('');
            setUpdating(userId);
            // Optimistic update so the change is visible the instant the
            // Lead picks a new role.
            setMembers((prev) =>
                prev ? prev.map((m) => (m.id === userId ? { ...m, role } : m)) : prev,
            );
            try {
                await api.setMemberRole(roomId, userId, role);
                // Broadcast a tick so every connected client (including the
                // affected member) refetches their role + member list. Using
                // Date.now() guarantees the value differs from the previous
                // bump even if two PATCHes land in the same tick.
                meta.set('membersVersion', Date.now());
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update role.');
                // Re-fetch to recover from any divergence.
                try {
                    const res = await api.getRoom(roomId);
                    setMembers(res.members);
                } catch {
                    /* noop */
                }
            } finally {
                setUpdating(null);
            }
        },
        [roomId, meta],
    );

    const useServerList = members !== null && members.length > 0;
    const sortedMembers = useMemo(() => {
        if (!useServerList) return [];
        // Lead first, then live members, then alphabetical.
        return [...members!].sort((a, b) => {
            if (a.role === 'lead' && b.role !== 'lead') return -1;
            if (b.role === 'lead' && a.role !== 'lead') return 1;
            const aLive = liveIds.has(a.id) ? 0 : 1;
            const bLive = liveIds.has(b.id) ? 0 : 1;
            if (aLive !== bLive) return aLive - bLive;
            return a.name.localeCompare(b.name);
        });
    }, [useServerList, members, liveIds]);

    return (
        <>
            <button
                data-canvas-chrome="members-toggle"
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Close members' : 'Open members'}
                className="pointer-events-auto absolute left-4 top-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all"
                style={{
                    background: 'rgba(20,15,10,0.78)',
                    border: '1px solid rgba(190,148,96,0.22)',
                    color: '#ede4d0',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)',
                }}
            >
                <Users size={15} strokeWidth={2.2} />
            </button>

            {/* Backdrop — click to close. */}
            {open && (
                <div
                    aria-hidden
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-40"
                    style={{ background: 'rgba(11,9,6,0.32)' }}
                />
            )}

            {/* Sliding panel. */}
            <aside
                data-canvas-chrome="members-sidebar"
                aria-label="Room members"
                className="fixed left-0 top-0 z-40 flex h-full w-[340px] flex-col transition-transform duration-300 ease-out"
                style={{
                    transform: open ? 'translateX(0)' : 'translateX(-100%)',
                    background: 'rgba(15,11,8,0.92)',
                    borderRight: '1px solid rgba(190,148,96,0.18)',
                    backdropFilter: 'blur(28px)',
                    boxShadow: open ? '24px 0 60px rgba(0,0,0,0.45)' : 'none',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4"
                    style={{ borderBottom: '1px solid rgba(190,148,96,0.12)' }}
                >
                    <div className="flex flex-col gap-0.5">
                        <span
                            className="font-mono text-[10px] uppercase tracking-[0.22em]"
                            style={{ color: 'rgba(190,148,96,0.7)' }}
                        >
                            {useServerList ? 'Members' : 'Live now'}
                        </span>
                        <h3
                            className="text-[15px] font-semibold"
                            style={{ color: '#ede4d0' }}
                        >
                            {useServerList
                                ? `${members!.length} member${members!.length === 1 ? '' : 's'}`
                                : `${liveOnlyMembers.length} on canvas`}
                        </h3>
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setOpen(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[rgba(190,148,96,0.12)]"
                        style={{ color: 'rgba(237,228,208,0.7)' }}
                    >
                        <X size={15} />
                    </button>
                </div>

                {error && (
                    <p
                        className="mx-4 mt-3 rounded-md px-3 py-2 text-[12px]"
                        style={{
                            background: 'rgba(180,50,50,0.1)',
                            border: '1px solid rgba(180,50,50,0.22)',
                            color: 'rgba(237,160,160,0.9)',
                        }}
                    >
                        {error}
                    </p>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                    {!loaded && open && (
                        <div className="flex items-center justify-center py-10">
                            <span
                                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                                style={{ color: 'rgba(237,228,208,0.4)' }}
                            >
                                Loading…
                            </span>
                        </div>
                    )}

                    {loaded && useServerList && (
                        <ul className="flex flex-col gap-1">
                            {sortedMembers.map((m) => {
                                const live = liveIds.has(m.id);
                                const isSelf = m.id === selfId;
                                return (
                                    <li
                                        key={m.id}
                                        className="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors"
                                        style={{
                                            background: isSelf
                                                ? 'rgba(190,148,96,0.06)'
                                                : 'transparent',
                                        }}
                                    >
                                        <Avatar name={m.name} color={m.color} live={live} />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="truncate text-[13.5px] font-medium"
                                                    style={{ color: '#ede4d0' }}
                                                >
                                                    {m.name}
                                                    {isSelf && (
                                                        <span
                                                            className="ml-1 font-normal"
                                                            style={{
                                                                color: 'rgba(237,228,208,0.4)',
                                                            }}
                                                        >
                                                            (you)
                                                        </span>
                                                    )}
                                                </span>
                                                {m.role === 'lead' && (
                                                    <Crown
                                                        size={11}
                                                        strokeWidth={2.4}
                                                        style={{ color: '#be9460' }}
                                                        aria-label="Lead"
                                                    />
                                                )}
                                            </div>
                                            <span
                                                className="truncate text-[11px]"
                                                style={{ color: 'rgba(237,228,208,0.38)' }}
                                            >
                                                {m.email}
                                            </span>
                                        </div>

                                        {isLead ? (
                                            <RoleSelect
                                                value={m.role}
                                                disabled={updating === m.id}
                                                onChange={(next) => handleRoleChange(m.id, next)}
                                            />
                                        ) : (
                                            <RoleBadge role={m.role} />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {loaded && !useServerList && (
                        <ul className="flex flex-col gap-1">
                            {liveOnlyMembers.map((m) => (
                                <li
                                    key={m.id}
                                    className="flex items-center gap-3 rounded-lg px-2.5 py-2.5"
                                    style={{
                                        background: m.isSelf
                                            ? 'rgba(190,148,96,0.06)'
                                            : 'transparent',
                                    }}
                                >
                                    <Avatar name={m.name} color={m.color} live />
                                    <span
                                        className="flex-1 truncate text-[13.5px] font-medium"
                                        style={{ color: '#ede4d0' }}
                                    >
                                        {m.name}
                                        {m.isSelf && (
                                            <span
                                                className="ml-1 font-normal"
                                                style={{ color: 'rgba(237,228,208,0.4)' }}
                                            >
                                                (you)
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{
                                            background: '#7fc995',
                                            boxShadow: '0 0 0 3px rgba(127,201,149,0.18)',
                                        }}
                                        aria-label="Live"
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer hint */}
                <div
                    className="px-5 py-3"
                    style={{
                        borderTop: '1px solid rgba(190,148,96,0.1)',
                        color: 'rgba(237,228,208,0.36)',
                    }}
                >
                    <p className="text-[11px] leading-[1.5]">
                        {useServerList
                            ? isLead
                                ? 'Pick a role on any member to update access. Changes apply instantly.'
                                : 'Only the Lead can change roles.'
                            : 'Sign in to manage member roles.'}
                    </p>
                </div>
            </aside>
        </>
    );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function Avatar({ name, color, live }: { name: string; color: string; live: boolean }) {
    const initials = (name || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]!.toUpperCase())
        .join('') || '?';
    return (
        <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: color }}>
            {initials}
            {live && (
                <span
                    aria-label="Live"
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
                    style={{
                        background: '#7fc995',
                        border: '2px solid rgba(15,11,8,0.92)',
                    }}
                />
            )}
        </span>
    );
}

function RoleBadge({ role }: { role: Role }) {
    return (
        <span
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: ROLE_DOT[role] }}
        >
            {ROLE_LABEL[role]}
        </span>
    );
}

function RoleSelect({
    value,
    disabled,
    onChange,
}: {
    value: Role;
    disabled: boolean;
    onChange: (next: Role) => void;
}) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return;
        function close() {
            setOpen(false);
        }
        window.addEventListener('mousedown', close);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });
        return () => window.removeEventListener('mousedown', close);
    }, [open]);

    return (
        <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
                style={{
                    background: 'rgba(190,148,96,0.08)',
                    border: '1px solid rgba(190,148,96,0.22)',
                    color: ROLE_DOT[value],
                }}
            >
                {ROLE_LABEL[value]}
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path
                        d="M3 4.5 6 7.5 9 4.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-[110%] z-10 w-40 rounded-md py-1 text-[12px]"
                    style={{
                        background: 'rgba(20,15,10,0.98)',
                        border: '1px solid rgba(190,148,96,0.22)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    }}
                >
                    {(['lead', 'contributor', 'viewer'] as Role[]).map((r) => {
                        const active = r === value;
                        return (
                            <button
                                key={r}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                onClick={() => {
                                    setOpen(false);
                                    if (!active) onChange(r);
                                }}
                                className="flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-[rgba(190,148,96,0.1)]"
                                style={{ color: '#ede4d0' }}
                            >
                                <span className="flex flex-col">
                                    <span className="text-[12px] font-medium">
                                        {ROLE_LABEL[r]}
                                    </span>
                                    <span
                                        className="text-[10px]"
                                        style={{ color: 'rgba(237,228,208,0.4)' }}
                                    >
                                        {r === 'lead'
                                            ? 'Full control'
                                            : r === 'contributor'
                                                ? 'Can edit canvas'
                                                : 'Read-only'}
                                    </span>
                                </span>
                                {active && (
                                    <Check
                                        size={12}
                                        strokeWidth={3}
                                        style={{ color: '#be9460' }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
