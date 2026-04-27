'use client';

/**
 * CanvasRoot — composes the Y room, identity, node subscription, and the
 * Canvas into a single ready-to-mount component for /room/[roomId].
 */

import { useMemo } from 'react';
import { useYRoom } from './useYRoom';
import { useYNodes } from './useYNodes';
import { useClientIdentity } from '@/lib/identity';
import { userColor } from '@/lib/user-color';
import { Canvas } from './Canvas';

interface CanvasRootProps {
    roomId: string;
}

export function CanvasRoot({ roomId }: CanvasRootProps) {
    const room = useYRoom(roomId);
    const identity = useClientIdentity();
    const nodes = useYNodes(room?.nodes ?? null);

    // Stable identity object so Canvas's awareness effect doesn't rebroadcast
    // on every render.
    const fullIdentity = useMemo(() => {
        if (!identity) return null;
        return {
            authorId: identity.authorId,
            authorName: identity.authorName,
            color: userColor(identity.authorId),
            roomRole: identity.roomRole,
        };
    }, [identity]);

    if (!room || !fullIdentity) {
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
            yNodes={room.nodes}
            nodes={nodes}
            identity={fullIdentity}
            provider={room.provider}
        />
    );
}
