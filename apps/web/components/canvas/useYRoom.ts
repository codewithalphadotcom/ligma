'use client';

/**
 * useYRoom — acquire/release a refcounted RoomHandle for a roomId.
 *
 * The returned handle is `null` on the first render (SSR/initial mount) and
 * the actual handle from the second render onward. This gives consumers a
 * clear loading boundary without breaking SSR.
 */

import { useEffect, useState } from 'react';
import { acquireRoom, releaseRoom, type RoomHandle } from '@/lib/yjs';

export function useYRoom(roomId: string): RoomHandle | null {
    const [room, setRoom] = useState<RoomHandle | null>(null);

    useEffect(() => {
        const handle = acquireRoom(roomId);
        setRoom(handle);
        return () => {
            setRoom(null);
            releaseRoom(roomId);
        };
    }, [roomId]);

    return room;
}
