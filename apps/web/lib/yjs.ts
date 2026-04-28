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
    /**
     * Free-form metadata channel for the room. Currently used to broadcast a
     * `membersVersion` bump whenever a Lead changes a member's role, so every
     * connected client refetches the authoritative server member list and the
     * caller's own role takes effect immediately (no refresh required).
     */
    meta: Y.Map<unknown>;
}

interface RoomEntry {
    handle: RoomHandle;
    refs: number;
    /** Timer that destroys the room after the last consumer leaves. */
    destroyTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, RoomEntry>();

/** Grace period before tearing down an idle room. Lets React StrictMode and
 *  fast route transitions reuse the same Y.Doc / WebSocket instead of churning
 *  the connection, which is what was producing the "connect → drop → connect"
 *  flapping users were seeing. */
const DESTROY_GRACE_MS = 1500;

export function acquireRoom(roomId: string, token?: string): RoomHandle {
    if (typeof window === 'undefined') {
        throw new Error('acquireRoom() must be called on the client.');
    }

    const existing = rooms.get(roomId);
    if (existing) {
        existing.refs += 1;
        if (existing.destroyTimer) {
            clearTimeout(existing.destroyTimer);
            existing.destroyTimer = null;
        }
        return existing.handle;
    }

    const doc = new Y.Doc();
    // Pre-create top-level shared types so observers can attach immediately.
    const nodes = doc.getMap<Y.Map<unknown>>('nodes');
    const tasks = doc.getArray<unknown>('tasks');
    const events = doc.getArray<unknown>('events');
    const meta = doc.getMap<unknown>('meta');

    // Connect to /room/:roomId on the backend. Authenticated users send the
    // Express JWT pulled from the NextAuth session; guest visitors connect
    // without a token and the server mints a per-connection guest userId.
    const lastSeqId = localStorage.getItem(`ligma:seq:${roomId}`) ?? '0';
    const params: Record<string, string> = { last_seq_id: lastSeqId };
    if (token && token.length > 0) params.token = token;
    const provider = new WebsocketProvider(`${env.wsUrl}/room`, roomId, doc, {
        connect: true,
        params,
    });

    // Re-broadcast connection lifecycle as window events so non-Y components
    // (e.g. the room header status indicator) can subscribe without holding
    // a provider reference.
    provider.on('status', ({ status }: { status: 'connecting' | 'connected' | 'disconnected' }) => {
        const eventName = status === 'connected'
            ? 'ligma:ws-connected'
            : status === 'disconnected'
                ? 'ligma:ws-disconnected'
                : 'ligma:ws-connecting';
        window.dispatchEvent(new CustomEvent(eventName, { detail: { roomId } }));
    });

    // Network resilience: when the OS reports the tab is offline the underlying
    // WebSocket often does NOT fire a `close` event — the browser keeps it in a
    // half-open zombie state. y-websocket therefore has no idea anything broke
    // and never schedules a reconnect, so when the network comes back peers
    // appear desynced until a manual reload.
    //
    // We bridge the gap by listening to window.online / window.offline and
    // forcing a fresh socket on `online`. Calling disconnect() then connect()
    // tears down any zombie connection and triggers a clean SyncStep1+2
    // handshake, which immediately reconciles state with the server.
    function onOnline() {
        try {
            provider.disconnect();
        } catch { /* ignore */ }
        // Re-arm immediately. y-websocket exposes connect() to (re)open the
        // socket and resume sync.
        try {
            provider.connect();
        } catch { /* ignore */ }
    }
    function onOffline() {
        // Eagerly flip UI state to disconnected so the header indicator
        // reacts the moment connectivity is lost, even if the socket has
        // not yet noticed.
        window.dispatchEvent(new CustomEvent('ligma:ws-disconnected', { detail: { roomId } }));
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Also recover when the tab returns to the foreground — laptops waking
    // from sleep often produce neither an `online` event nor a socket close,
    // but they do fire `visibilitychange`.
    function onVisibility() {
        if (document.visibilityState !== 'visible') return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        if (provider.wsconnected) return;
        try { provider.disconnect(); } catch { /* ignore */ }
        try { provider.connect(); } catch { /* ignore */ }
    }
    document.addEventListener('visibilitychange', onVisibility);

    const handle: RoomHandle = { roomId, doc, provider, nodes, tasks, events, meta };
    rooms.set(roomId, { handle, refs: 1, destroyTimer: null });
    // Stash cleanup on the entry via a closure-bound symbol property so
    // releaseRoom can unregister listeners on teardown.
    (handle as RoomHandle & { __netCleanup?: () => void }).__netCleanup = () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        document.removeEventListener('visibilitychange', onVisibility);
    };
    return handle;
}

export function releaseRoom(roomId: string): void {
    const entry = rooms.get(roomId);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs > 0) return;
    // Defer teardown so a quick remount (StrictMode, route change, hot reload)
    // can re-acquire the same handle without dropping the WebSocket.
    if (entry.destroyTimer) clearTimeout(entry.destroyTimer);
    entry.destroyTimer = setTimeout(() => {
        const current = rooms.get(roomId);
        if (!current || current.refs > 0) return;
        try {
            (current.handle as RoomHandle & { __netCleanup?: () => void }).__netCleanup?.();
        } catch { /* ignore */ }
        try {
            current.handle.provider.disconnect();
            current.handle.provider.destroy();
        } catch {
            /* swallow — already destroyed */
        }
        current.handle.doc.destroy();
        rooms.delete(roomId);
    }, DESTROY_GRACE_MS);
}
