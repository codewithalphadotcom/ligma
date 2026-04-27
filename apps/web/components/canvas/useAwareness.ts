'use client';

/**
 * useAwareness — subscribes to the WebsocketProvider's awareness protocol and
 * exposes a deduped map of remote presence states.
 *
 * Awareness is Y.js's "ephemeral state" channel — perfect for cursor positions
 * and selections that should NOT be persisted in the doc history.
 *
 * Returns a Map keyed by clientId for *remote* peers only. The local user's
 * presence is filtered out (they don't need to see their own cursor twice —
 * the OS already renders it).
 */

import { useEffect, useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';
import type { UserPresence } from '@/lib/types';

export type PresenceMap = Map<number, UserPresence>;

export function useAwareness(
    provider: WebsocketProvider | null,
): PresenceMap {
    const [presence, setPresence] = useState<PresenceMap>(() => new Map());

    useEffect(() => {
        if (!provider) return;
        const awareness = provider.awareness;
        const localClientId = awareness.clientID;

        function recompute() {
            const states = awareness.getStates();
            const next: PresenceMap = new Map();
            states.forEach((state, clientId) => {
                if (clientId === localClientId) return;
                const p = state as Partial<UserPresence>;
                if (!p.user) return;
                next.set(clientId, {
                    user: p.user,
                    cursor: p.cursor ?? null,
                });
            });
            setPresence(next);
        }

        recompute();
        awareness.on('change', recompute);
        return () => {
            awareness.off('change', recompute);
        };
    }, [provider]);

    return presence;
}
