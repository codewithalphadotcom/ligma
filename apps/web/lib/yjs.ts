/**
 * Per-room Y.Doc + WebsocketProvider singletons with reference counting.
 *
 * Why singletons:
 *   React StrictMode double-invokes effects, and multiple components in the
 *   same room (Canvas, TaskBoard, EventLog) all need the SAME Y.Doc. Creating
 *   a fresh Doc per consumer would fork the CRDT state.
 *
 * Refcounting:
 *   acquireRoom() increments. releaseRoom() decrements. When the count hits 0
 *   we destroy the provider AND the doc, freeing memory & closing the socket.
 *
 * SSR-safety:
 *   This module touches WebSocket — only call from client components / effects.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { env } from './env';

export interface RoomHandle {
    roomId: string;
    doc: Y.Doc;
    provider: WebsocketProvider;
    /** Convenience: the canonical Y.Map of nodes for this room. */
    nodes: Y.Map<Y.Map<unknown>>;
    /** Convenience: the canonical Y.Array of tasks for this room. */
    tasks: Y.Array<unknown>;
    /** Convenience: append-only mirror of events for the side panel. */
    events: Y.Array<unknown>;
}

interface RoomEntry {
    handle: RoomHandle;
    refs: number;
}

const rooms = new Map<string, RoomEntry>();

export function acquireRoom(roomId: string): RoomHandle {
    if (typeof window === 'undefined') {
        throw new Error('acquireRoom() must be called on the client.');
    }

    const existing = rooms.get(roomId);
    if (existing) {
        existing.refs += 1;
        return existing.handle;
    }

    const doc = new Y.Doc();
    // Pre-create top-level shared types so observers can attach immediately.
    const nodes = doc.getMap<Y.Map<unknown>>('nodes');
    const tasks = doc.getArray<unknown>('tasks');
    const events = doc.getArray<unknown>('events');

    // y-websocket joins room "ligma-<roomId>" on the configured server.
    const provider = new WebsocketProvider(env.wsUrl, `ligma-${roomId}`, doc, {
        connect: true,
    });

    const handle: RoomHandle = { roomId, doc, provider, nodes, tasks, events };
    rooms.set(roomId, { handle, refs: 1 });
    return handle;
}

export function releaseRoom(roomId: string): void {
    const entry = rooms.get(roomId);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs > 0) return;
    // Last consumer left — tear everything down.
    try {
        entry.handle.provider.disconnect();
        entry.handle.provider.destroy();
    } catch {
        /* swallow — already destroyed */
    }
    entry.handle.doc.destroy();
    rooms.delete(roomId);
}
