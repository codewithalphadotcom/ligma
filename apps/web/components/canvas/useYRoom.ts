'use client';

/**
 * useYRoom — acquire/release a refcounted RoomHandle for a roomId.
 *
 * Returns `null` only on the server / before the client effect runs.
 * Connects with the Express JWT when an authenticated NextAuth session
 * exists; otherwise connects as a guest (the backend mints a per-connection
 * guest userId for tokenless visitors).
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { acquireRoom, releaseRoom, type RoomHandle } from '@/lib/yjs';

export function useYRoom(roomId: string): RoomHandle | null {
    const { data: session, status } = useSession();
    const [room, setRoom] = useState<RoomHandle | null>(null);

    // Wait for NextAuth to settle ("loading" -> "authenticated" or
    // "unauthenticated") before connecting, so an authenticated user
    // doesn't first connect anonymously and then reconnect with their
    // JWT a tick later.
    const ready = status !== 'loading';
    const token = session?.apiToken;

    useEffect(() => {
        if (!ready) return;
        const handle = acquireRoom(roomId, token);
        setRoom(handle);
        return () => {
            setRoom(null);
            releaseRoom(roomId);
        };
    }, [roomId, ready, token]);

    return room;
}
