'use client';

/**
 * Client-side event recorder for Time-Travel Replay (A11).
 *
 * Subscribes to `provider.doc.on('update', ...)` and accumulates every Y.js
 * update bytestring with its origin tag in an in-memory log. The first time
 * a recorder is created for a given provider we capture the doc's current
 * encoded state as the *baseline* snapshot — so the replay range is always
 *   [0 .. events.length] :: 0 = baseline state, N = after applying first N
 *                          recorded updates.
 *
 * Key design decisions:
 *   - Recorder is *per-provider* and refcounted, so multiple consumers
 *     (TimelineReplay UI, future Event Log sidebar, AI pipeline) share one
 *     log.
 *   - Updates whose origin is `replay-render` are skipped so replay-derived
 *     side-effects (we don't apply any to the live doc, but defence in depth)
 *     don't loop.
 *   - We don't truncate the log. For a 30-minute hackathon demo memory is a
 *     non-issue; for prod B's server log replaces this entirely.
 *
 * When B's server-side event log is wired in, the API surface
 * (`useEventLog`, `getRecorder().eventsAt(i)`) stays the same — we just swap
 * the source.
 */

import * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import type { RecordedEvent } from '@/lib/types';

/** A registered recorder lives as long as the provider. */
interface RecorderEntry {
    baseline: Uint8Array;
    events: RecordedEvent[];
    listeners: Set<() => void>;
    unsubscribe: () => void;
    refs: number;
}

const recorders = new WeakMap<WebsocketProvider, RecorderEntry>();

/** Per-recorder monotonic counter — 0-based. */
let nextSeq = 0;

export interface EventRecorder {
    /** Initial doc snapshot, captured at recorder creation time. */
    readonly baseline: Uint8Array;
    /** Live array of recorded events (do not mutate). */
    readonly events: ReadonlyArray<RecordedEvent>;
    /** Subscribe to log changes. Returns an unsubscribe fn. */
    subscribe: (cb: () => void) => () => void;
    /** Decrement refcount; cleans up when no consumers remain. */
    release: () => void;
}

export function acquireEventRecorder(provider: WebsocketProvider): EventRecorder {
    let entry = recorders.get(provider);
    if (!entry) {
        const baseline = Y.encodeStateAsUpdate(provider.doc);
        const events: RecordedEvent[] = [];
        const listeners = new Set<() => void>();

        const onUpdate = (update: Uint8Array, origin: unknown) => {
            // Skip updates produced by the replay machinery itself.
            const tag =
                typeof origin === 'string'
                    ? origin
                    : origin && typeof origin === 'object' && 'constructor' in origin
                        ? (origin as { constructor: { name?: string } }).constructor
                            ?.name ?? 'remote'
                        : 'remote';
            if (tag === 'replay-render') return;

            events.push({
                seq: nextSeq++,
                ts: Date.now(),
                update,
                origin: tag,
            });
            for (const cb of listeners) cb();
        };

        provider.doc.on('update', onUpdate);
        entry = {
            baseline,
            events,
            listeners,
            unsubscribe: () => provider.doc.off('update', onUpdate),
            refs: 0,
        };
        recorders.set(provider, entry);
    }
    entry.refs += 1;
    const e = entry;

    return {
        baseline: e.baseline,
        events: e.events,
        subscribe(cb) {
            e.listeners.add(cb);
            return () => {
                e.listeners.delete(cb);
            };
        },
        release() {
            e.refs -= 1;
            if (e.refs > 0) return;
            e.unsubscribe();
            e.listeners.clear();
            recorders.delete(provider);
        },
    };
}
