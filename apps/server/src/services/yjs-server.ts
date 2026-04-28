import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { WebSocket } from 'ws';
import { logEvent, getEventsSince } from './event-log.ts';
import {
  ensureRoomMembership,
  getUserRoomRole,
  canMutate,
  canEditNode,
  type RoomRole,
  type NodeAcl,
} from './rbac.ts';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SYNC_STEP_1 = 0; // read-only — client just wants server's state vector
const SYNC_STEP_2 = 1; // carries a full state-as-update payload
const SYNC_UPDATE = 2; // carries an incremental update payload

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  /**
   * Resolves once the room's persisted history has been replayed into
   * `doc`. Every connection awaits this before doing the Yjs sync
   * handshake so peers always see the full server-truth state — even
   * after a server restart, hot reload, or a previous teardown when the
   * last client briefly disconnected.
   */
  loaded: Promise<void>;
}

const rooms = new Map<string, Room>();

/** Internal sentinel used as the transaction origin when we apply persisted
 *  updates back into `room.doc` during hydration. The doc-update handlers
 *  attached per-connection skip broadcasting when they see this origin
 *  (no client should be "told" about state they fetched via SyncStep1). */
const HYDRATION_ORIGIN = Symbol('ligma:hydration');

/**
 * Postgres `rooms.id` is a UUID column. Any non-UUID roomId (e.g. the
 * built-in `/room/demo` public room, or share-links with custom slugs) has
 * no row in the `rooms` table, so every DB call keyed on it (membership
 * lookups, event-log inserts, history reads) throws
 * `invalid input syntax for type uuid`.
 *
 * We treat those as **ephemeral public rooms**: in-memory only, no RBAC,
 * everyone is a contributor, no persistence. This is what makes the demo
 * room work for both signed-in and guest users without surprise FK errors.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isPersistentRoom(roomId: string): boolean {
  return UUID_RE.test(roomId);
}

async function hydrateRoom(roomId: string, doc: Y.Doc): Promise<void> {
  if (!isPersistentRoom(roomId)) return; // ephemeral — nothing persisted
  try {
    // `0` — fetch the entire history. Cheap (single indexed query) and
    // makes the doc fully self-contained without depending on any client's
    // local cache.
    const history = await getEventsSince(roomId, 0);
    if (history.length === 0) return;
    doc.transact(() => {
      for (const event of history) {
        const b64 = event.payload?.update as string | undefined;
        if (!b64) continue;
        try {
          const update = Buffer.from(b64, 'base64');
          Y.applyUpdate(doc, new Uint8Array(update), HYDRATION_ORIGIN);
        } catch (err) {
          console.error('[hydrate] bad update payload, skipping:', err);
        }
      }
    }, HYDRATION_ORIGIN);
  } catch (err) {
    console.error('[hydrate] failed to load room history:', err);
    // Don't rethrow — we still let the connection proceed with whatever
    // state we managed to apply (or none).
  }
}

/**
 * Fields whose mutation counts as a "structural" edit — i.e., subject to
 * the node's ACL gate. We deliberately exclude `comments` because per the
 * spec ANY participant (including Viewers) can comment on locked nodes.
 *
 * `content` (Y.Text) is included as a stringified snapshot so any character
 * insert/delete is detected as a structural change.
 */
const HASHED_FIELDS = [
  'type',
  'x',
  'y',
  'w',
  'h',
  'color',
  'authorId',
  'classification',
  'taskId',
  'fontSize',
  'fill',
  'strokeWidth',
  'updatedAt',
] as const;

interface NodeAclSnapshot {
  acl: NodeAcl;
  authorId: string;
  /** Stable JSON over all gated fields — diff to detect structural change. */
  hash: string;
}

function hashNode(m: Y.Map<unknown>): string {
  const obj: Record<string, unknown> = {};
  for (const f of HASHED_FIELDS) {
    const v = m.get(f);
    obj[f] = v === undefined ? null : (v as unknown);
  }
  const content = m.get('content');
  obj.content =
    content instanceof Y.Text
      ? content.toString()
      : typeof content === 'string'
        ? content
        : '';
  const points = m.get('points');
  obj.points = points instanceof Y.Array ? JSON.stringify(points.toArray()) : '';
  return JSON.stringify(obj);
}

function snapshotNodes(doc: Y.Doc): Map<string, NodeAclSnapshot> {
  const out = new Map<string, NodeAclSnapshot>();
  const nodes = doc.getMap<Y.Map<unknown>>('nodes');
  for (const [id, m] of nodes.entries()) {
    if (!(m instanceof Y.Map)) continue;
    out.set(id, {
      acl: ((m.get('acl') as NodeAcl) ?? 'all'),
      authorId: ((m.get('authorId') as string) ?? ''),
      hash: hashNode(m),
    });
  }
  return out;
}

/**
 * Validate an incoming Y.js update against per-node ACLs.
 *
 * Strategy: clone `roomDoc`'s state into a throwaway doc, apply the candidate
 * update, diff `nodes` before/after. For any node whose hashed fields
 * changed (i.e. NOT a comments-only mutation), the OLD `acl` must allow the
 * caller's `role` to edit. ACL field changes themselves require Lead. Node
 * deletions are gated by the deleted node's old ACL.
 *
 * Returns `{ ok: true }` if the update is fully permitted. Otherwise
 * `{ ok: false, reason }` and the caller should DROP the update.
 */
/**
 * Exported for unit tests. Same logic the WS handler uses; not part of the
 * runtime API surface.
 */
export function validateAcls(
  roomDoc: Y.Doc,
  update: Uint8Array,
  role: RoomRole,
): { ok: true } | { ok: false; reason: string } {
  const before = snapshotNodes(roomDoc);

  // Cheap-enough clone for hackathon-scale rooms (a few hundred nodes max).
  const clone = new Y.Doc();
  try {
    Y.applyUpdate(clone, Y.encodeStateAsUpdate(roomDoc));
    Y.applyUpdate(clone, update);
  } catch (err) {
    return { ok: false, reason: `malformed update: ${(err as Error).message}` };
  }

  const after = snapshotNodes(clone);

  // Mutations / creations.
  for (const [id, post] of after) {
    const pre = before.get(id);
    if (!pre) continue; // CREATE — covered by canMutate at the caller.

    // Changing the ACL itself is privileged — checked before the hash
    // short-circuit because `acl` is intentionally NOT in HASHED_FIELDS
    // (we want comments-only mutations to be free).
    if (pre.acl !== post.acl && role !== 'lead') {
      return { ok: false, reason: `node ${id}: only Lead can change ACL` };
    }

    if (pre.hash === post.hash) continue; // only comments / no-op

    if (!canEditNode(role, pre.acl)) {
      return { ok: false, reason: `node ${id}: role=${role} blocked by acl=${pre.acl}` };
    }
  }

  // Deletions.
  for (const [id, pre] of before) {
    if (after.has(id)) continue;
    if (!canEditNode(role, pre.acl)) {
      return { ok: false, reason: `node ${id}: role=${role} cannot delete acl=${pre.acl}` };
    }
  }

  return { ok: true };
}

/**
 * After dropping a forbidden update, push the canonical server state back
 * to the offending client so y-websocket can reconcile its local Y.Doc.
 *
 * For the threat model judges test ("malicious client bypasses RBAC via raw
 * WebSocket"), the critical invariant is that NO peer ever sees the rejected
 * mutation and persisted history (event_log) never records it. Reloading
 * the offending client reseats them to authoritative state from history.
 */
function sendCorrectiveSync(ws: WebSocket, doc: Y.Doc): void {
  const e1 = encoding.createEncoder();
  encoding.writeVarUint(e1, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(e1, doc);
  send(ws, encoding.toUint8Array(e1));

  const e2 = encoding.createEncoder();
  encoding.writeVarUint(e2, MESSAGE_SYNC);
  syncProtocol.writeSyncStep2(e2, doc);
  send(ws, encoding.toUint8Array(e2));
}

export function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    const loaded = hydrateRoom(roomId, doc);
    room = { doc, awareness, clients: new Set(), loaded };
    rooms.set(roomId, room);
  }
  return room;
}

export function getDoc(roomId: string): Y.Doc {
  return getRoom(roomId).doc;
}

/**
 * Force every connected client of `roomId` to refetch authoritative member
 * roles, and trigger each WebSocket's local role cache to be invalidated on
 * its next message. Called from the rooms PATCH route after a Lead changes
 * a member's role via REST — without this, a Lead who promotes/demotes via
 * the API (instead of the UI) wouldn't propagate the change until the next
 * client-driven `meta.membersVersion` bump.
 */
export function broadcastRoleChange(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  // Mutating the meta Y.Map flows through the doc-update broadcast path and
  // also fires the per-connection meta observer that invalidates the role
  // cache server-side. Origin tag is informational; not gated by RBAC since
  // we mutate `doc` directly (no incoming WS update).
  room.doc.transact(() => {
    room.doc.getMap<unknown>('meta').set('membersVersion', Date.now());
  }, 'rbac:role-change');
}

function send(ws: WebSocket, message: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
}

export async function handleConnection(
  ws: WebSocket,
  roomId: string,
  userId: string,
  lastSeqId?: number,
  isGuest = false,
): Promise<void> {
  const room = getRoom(roomId);
  room.clients.add(ws);

  // Block the sync handshake until the room's persisted history has been
  // replayed into `room.doc`. Without this, a peer that connects to a
  // freshly-created (or restarted) room would receive an empty SyncStep2
  // and silently miss every node ever created in that room — which is
  // exactly the "can't see other people's edits even after reload" bug.
  await room.loaded;

  // Fetch role once — used for RBAC on every incoming message.
  //
  // Two paths bypass the DB and treat the user as a contributor:
  //   1. Guests (no JWT) — they have no `users` row to FK against.
  //   2. Ephemeral public rooms (non-UUID roomId, e.g. `/room/demo`) —
  //      there's no `rooms` row, so the membership query would throw
  //      `invalid input syntax for type uuid`. Everyone joins as a
  //      contributor, identical to the guest experience. This is what
  //      makes `/room/demo` actually shared between auth+guest users.
  const persistentRoom = isPersistentRoom(roomId);
  const roleSkipsDb = !persistentRoom || isGuest;
  let userRole: RoomRole = roleSkipsDb
    ? 'contributor'
    : ((await ensureRoomMembership(userId, roomId, 'contributor')) ?? 'contributor');

  /**
   * Live role refresh.
   *
   * The role is cached for `ROLE_TTL_MS` to avoid hitting Postgres on every
   * keystroke. When a Lead PATCHes a member's role, the client bumps
   * `meta.membersVersion` in the shared Y.Doc — that mutation also fires
   * the meta observer below on the SERVER side, which marks the cache stale
   * so the next mutation message refetches the authoritative role from the
   * DB. This is what makes "live demotion takes effect without reload"
   * work end-to-end: the offending user's WebSocket starts dropping
   * mutations within ~1 round-trip of the role change.
   */
  const ROLE_TTL_MS = 1000;
  let roleCachedAt = Date.now();

  async function refreshRoleIfStale(): Promise<RoomRole> {
    if (roleSkipsDb) return userRole;
    if (Date.now() - roleCachedAt < ROLE_TTL_MS) return userRole;
    try {
      const fresh = await getUserRoomRole(userId, roomId);
      // `null` means the user was removed from the room entirely — treat as
      // viewer so all subsequent mutations are dropped.
      userRole = fresh ?? 'viewer';
    } catch (err) {
      console.error('[rbac] role refresh failed:', err);
    }
    roleCachedAt = Date.now();
    return userRole;
  }

  // Invalidate the role cache whenever a Lead bumps `meta.membersVersion`
  // in this room. (See MembersSidebar.tsx: it sets the key after every
  // successful PATCH /rooms/:id/members.)
  const metaMap = room.doc.getMap<unknown>('meta');
  const onMetaChange = (e: Y.YMapEvent<unknown>) => {
    if (e.keysChanged.has('membersVersion')) {
      roleCachedAt = 0;
    }
  };
  metaMap.observe(onMetaChange);

  // Doc update handler — relay binary delta to THIS client + persist to event log.
  //
  // This handler is registered once per WebSocket connection. When the shared
  // doc emits an 'update', every connected client's handler runs. Each one
  // sends the update to its own socket (`ws`), unless this socket was the
  // origin of the update (we'd be echoing it back).
  //
  // The previous implementation called `broadcast(room, ws, ...)` from inside
  // every per-client handler, which produced N² sends and (because of an
  // early `if (origin === ws) return`) ALSO dropped legitimate fan-out — so
  // peers only saw each other's edits after a full reconnect/reload.
  const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
    // Hydration writes the persisted history back into the doc on room
    // creation. They aren't "new" edits — every client that reaches
    // SyncStep2 already gets this state — so we must NOT broadcast them
    // here, and we must NOT re-persist them (would duplicate every event
    // forever on every server restart).
    if (origin === HYDRATION_ORIGIN) return;

    if (origin === ws) {
      // This connection is the origin — don't echo to ourselves, but DO
      // persist the event exactly once (here, from the originator's handler).
      // Skip persistence for guests AND ephemeral rooms (their roomId isn't
      // a UUID, so the events-table FK would reject the insert).
      if (!isGuest && persistentRoom) {
        logEvent({
          roomId,
          userId,
          eventType: 'doc_update',
          nodeId: null,
          payload: { update: Buffer.from(update).toString('base64') },
        }).catch((err) => console.error('event-log error:', err));
      }
      return;
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    send(ws, encoding.toUint8Array(encoder));
  };

  // Awareness update handler — relay presence changes to THIS client.
  // Same per-connection fan-out pattern as docUpdateHandler.
  const awarenessUpdateHandler = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === ws) return; // originator — don't echo back
    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients),
    );
    send(ws, encoding.toUint8Array(encoder));
  };

  // IMPORTANT: register the doc/awareness update handlers BEFORE we send
  // SyncStep1+SyncStep2. If a peer makes an edit between our SyncStep2
  // and the handler being attached, this client would silently miss it.
  // Registering early is safe — Yjs is a CRDT, so the occasional duplicate
  // update during handshake just merges harmlessly on the client.
  room.doc.on('update', docUpdateHandler);
  room.awareness.on('update', awarenessUpdateHandler);

  // Sync step 1: send server's state vector so client knows what we have.
  // Because we awaited `room.loaded` above, this vector reflects the FULL
  // persisted history — the client's responding SyncStep2 will carry every
  // node, stroke, comment, etc. that this room has ever contained.
  const syncStep1Encoder = encoding.createEncoder();
  encoding.writeVarUint(syncStep1Encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncStep1Encoder, room.doc);
  send(ws, encoding.toUint8Array(syncStep1Encoder));

  // Also proactively send our state as SyncStep2 so the client doesn't have
  // to wait a round-trip to receive history. y-websocket's protocol handler
  // is happy to receive SyncStep2 unsolicited and will just merge it in.
  const syncStep2Encoder = encoding.createEncoder();
  encoding.writeVarUint(syncStep2Encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep2(syncStep2Encoder, room.doc);
  send(ws, encoding.toUint8Array(syncStep2Encoder));

  // Send current awareness states
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(awarenessStates.keys())),
    );
    send(ws, encoding.toUint8Array(awarenessEncoder));
  }

  // (Per-client `getEventsSince` replay used to live here. It's now
  // redundant: `room.doc` is hydrated from the same events table on first
  // creation, and the SyncStep1/SyncStep2 handshake above gives the
  // connecting client every byte of state it doesn't already have. We keep
  // accepting `lastSeqId` from the URL for backwards compatibility, but
  // it's intentionally unused.)
  void lastSeqId;
  void getEventsSince;

  ws.on('message', async (data: Buffer) => {
    const message = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const decoder = decoding.createDecoder(message);
    const msgType = decoding.readVarUint(decoder);

    if (msgType === MESSAGE_AWARENESS) {
      // Awareness is presence-only (cursors, names) — not subject to RBAC.
      awarenessProtocol.applyAwarenessUpdate(
        room.awareness,
        decoding.readVarUint8Array(decoder),
        ws,
      );
      return;
    }

    if (msgType !== MESSAGE_SYNC) return;

    const syncSubtype = decoding.readVarUint(decoder);

    // SyncStep1 is read-only — the client is asking for our state. Reply
    // with a SyncStep2 carrying the diff against their state vector.
    if (syncSubtype === SYNC_STEP_1) {
      const stateVector = decoding.readVarUint8Array(decoder);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      encoding.writeVarUint(encoder, SYNC_STEP_2);
      encoding.writeVarUint8Array(
        encoder,
        Y.encodeStateAsUpdate(room.doc, stateVector),
      );
      send(ws, encoding.toUint8Array(encoder));
      return;
    }

    // Anything else must be SyncStep2 or Update — both carry mutations.
    if (syncSubtype !== SYNC_STEP_2 && syncSubtype !== SYNC_UPDATE) return;

    let update: Uint8Array;
    try {
      update = decoding.readVarUint8Array(decoder);
    } catch (err) {
      console.warn('[ws] malformed sync message:', err);
      return;
    }

    // Room-level role gate (B8). Refreshed on every message with a 1s TTL,
    // and force-refetched whenever `meta.membersVersion` changes — this is
    // what makes live role demotion take effect server-side without a
    // reconnect.
    const role = await refreshRoleIfStale();
    if (!canMutate(role)) {
      sendCorrectiveSync(ws, room.doc);
      return;
    }

    // Per-node ACL gate (only meaningful for persistent rooms — ephemeral
    // demo rooms have no membership concept, so every node is `acl: 'all'`).
    if (persistentRoom) {
      const verdict = validateAcls(room.doc, update, role);
      if (!verdict.ok) {
        console.warn(
          `[rbac] dropped update from user=${userId} role=${role}: ${verdict.reason}`,
        );
        sendCorrectiveSync(ws, room.doc);
        return;
      }
    }

    // Validated — apply to the canonical doc. The `ws` origin tag drives
    // the docUpdateHandler fan-out: peers receive the update; the
    // originator does NOT (avoids echo) but DOES persist to event_log.
    try {
      Y.applyUpdate(room.doc, update, ws);
    } catch (err) {
      console.error('[ws] applyUpdate failed:', err);
      sendCorrectiveSync(ws, room.doc);
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    room.doc.off('update', docUpdateHandler);
    room.awareness.off('update', awarenessUpdateHandler);
    metaMap.unobserve(onMetaChange);
    awarenessProtocol.removeAwarenessStates(room.awareness, [room.doc.clientID], userId);

    if (room.clients.size === 0) {
      room.doc.destroy();
      rooms.delete(roomId);
    }
  });
}
