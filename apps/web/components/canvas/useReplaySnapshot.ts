'use client';

/**
 * useReplaySnapshot — derives a NodeSnapshot[] for the current replayIndex.
 *
 * Maintains a single ghost Y.Doc per provider via createReplayDoc and
 * reseeks on every replayIndex change. Returns null when not replaying so
 * the caller can fall back to the live snapshot stream.
 */

import { useEffect, useMemo, useState } from 'react';
import type { NodeSnapshot, RecordedEvent } from '@/lib/types';
import { createReplayDoc, type ReplayDoc } from './replay-snapshot';

export function useReplaySnapshot(
    replayIndex: number | null,
    baseline: Uint8Array,
    events: RecordedEvent[],
): NodeSnapshot[] | null {
    // One replay doc per (baseline). When the baseline changes (e.g. provider
    // swap or a new room) we recreate.
    const replayDoc = useMemo<ReplayDoc | null>(() => {
        if (baseline.length === 0) return null;
        return createReplayDoc(baseline);
    }, [baseline]);

    // Tear down on unmount / baseline change.
    useEffect(() => {
        return () => {
            replayDoc?.destroy();
        };
    }, [replayDoc]);

    const [snapshot, setSnapshot] = useState<NodeSnapshot[] | null>(null);

    useEffect(() => {
        if (replayIndex === null || replayDoc === null) {
            setSnapshot(null);
            return;
        }
        setSnapshot(replayDoc.seekTo(replayIndex, baseline, events));
    }, [replayIndex, replayDoc, baseline, events]);

    return snapshot;
}
