'use client';

/**
 * CanvasRoot — composes the Y room, identity, node subscription, and the
 * Canvas into a single ready-to-mount component for /room/[roomId].
 */

import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { useYRoom } from './useYRoom';
import { useYNodes } from './useYNodes';
import { useClientIdentity } from '@/lib/identity';
import { userColor } from '@/lib/user-color';
import { api } from '@/lib/api';
import type { RoomRole } from '@/lib/types';
import { Canvas } from './Canvas';

interface CanvasRootProps {
    roomId: string;
}

export function CanvasRoot({ roomId }: CanvasRootProps) {
    const room = useYRoom(roomId);
    const identity = useClientIdentity();
    const nodes = useYNodes(room?.nodes ?? null);

    // Server-truth role for this room. We do NOT trust the localStorage debug
    // toggle in identity.roomRole because non-leads would otherwise render as
    // 'lead' (it defaults to 'lead'), which leaks the lock badge and wrongly
    // grants edit permission to joinees on lead-only nodes.
    //
    // For the demo room and unauthenticated guests `joinRoom` 404/401s — in
    // that case the fallback role is 'contributor' (everyone is equal there),
    // unless the localStorage debug toggle is non-default.
    const [serverRole, setServerRole] = useState<RoomRole | null>(null);
    const [roleResolved, setRoleResolved] = useState(false);
    // Bumped whenever any Lead PATCHes a member role (broadcast via the Y
    // doc's `meta` map). When this changes, refetch the caller's role so a
    // demoted/promoted user sees their permissions update immediately.
    const [roleRevision, setRoleRevision] = useState(0);

    useEffect(() => {
        let cancelled = false;
        // Only block the initial resolution on the first fetch — subsequent
        // refetches (triggered by `roleRevision`) should never re-show the
        // "Connecting…" splash, so we leave `roleResolved` true after the
        // first round-trip.
        if (roleRevision === 0) {
            setRoleResolved(false);
            setServerRole(null);
        }
        (async () => {
            try {
                const res = await api.joinRoom(roomId);
                if (!cancelled) setServerRole(res.role);
            } catch {
                if (!cancelled && roleRevision === 0) setServerRole(null);
            } finally {
                if (!cancelled) setRoleResolved(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [roomId, roleRevision]);

    // Subscribe to the room's `meta` Y.Map. When the Lead bumps
    // `membersVersion` after a role change, every client (including the
    // demoted/promoted user) re-runs the role-resolve effect above and
    // refetches the authoritative server role.
    useEffect(() => {
        if (!room) return;
        const meta = room.meta;
        function onChange(e: Y.YMapEvent<unknown>) {
            if (e.keysChanged.has('membersVersion')) {
                setRoleRevision((v) => v + 1);
            }
        }
        meta.observe(onChange);
        return () => meta.unobserve(onChange);
    }, [room]);

    // Stable identity object so Canvas's awareness effect doesn't rebroadcast
    // on every render.
    const fullIdentity = useMemo(() => {
        if (!identity) return null;
        // Server role wins when available. For ephemeral public rooms
        // (`/room/demo`, share-link slugs that aren't UUIDs) `joinRoom`
        // 404s and `serverRole` stays null — in that case nobody owns the
        // room and everyone is a contributor. We deliberately ignore the
        // localStorage debug toggle here because it defaults to 'lead' and
        // would otherwise leak the lock badge / ACL popover into a public
        // room that has no concept of ownership.
        const role: RoomRole = serverRole ?? 'contributor';
        return {
            authorId: identity.authorId,
            authorName: identity.authorName,
            color: userColor(identity.authorId),
            roomRole: role,
        };
    }, [identity, serverRole]);

    if (!room || !fullIdentity || !roleResolved) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-neutral-100 dark:bg-neutral-900">
                <div className="animate-pulse text-sm text-neutral-500">
                    Connecting to room…
                </div>
            </div>
        );
    }

    return (
        <Canvas
            roomId={roomId}
            yNodes={room.nodes}
            nodes={nodes}
            identity={fullIdentity}
            provider={room.provider}
            meta={room.meta}
        />
    );
}
