'use client';

/**
 * useEventLog — React hook that returns a stable list of RecordedEvent for
 * the given provider. Manages recorder lifecycle (acquire on mount, release
 * on unmount) and triggers re-renders when new events arrive.
 *
 * NOTE: The returned `events` is a *snapshot* — if you need to react to log
 * length changes, depend on `events.length`.
 */

import { useEffect, useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';
import type { RecordedEvent } from '@/lib/types';
import { acquireEventRecorder } from './event-recorder';

export interface EventLog {
    baseline: Uint8Array;
    events: RecordedEvent[];
}

export function useEventLog(provider: WebsocketProvider): EventLog {
    const [log, setLog] = useState<EventLog>(() => ({
        baseline: new Uint8Array(),
        events: [],
    }));

    useEffect(() => {
        const recorder = acquireEventRecorder(provider);
        // Push initial state synchronously.
        setLog({ baseline: recorder.baseline, events: [...recorder.events] });
        const unsub = recorder.subscribe(() => {
            // Snapshot the array each time so React detects a new reference.
            setLog({ baseline: recorder.baseline, events: [...recorder.events] });
        });
        return () => {
            unsub();
            recorder.release();
        };
    }, [provider]);

    return log;
}
