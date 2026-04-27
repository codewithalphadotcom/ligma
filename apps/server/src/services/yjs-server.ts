import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { WebSocket } from 'ws';
import { logEvent, getEventsSince } from './event-log.js';
import { getUserRoomRole, canMutate } from './rbac.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SYNC_STEP_1 = 0; // read-only — client just wants server's state vector

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
}

const rooms = new Map<string, Room>();

export function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    room = { doc, awareness, clients: new Set() };
    rooms.set(roomId, room);
  }
  return room;
}

export function getDoc(roomId: string): Y.Doc {
  return getRoom(roomId).doc;
}

function send(ws: WebSocket, message: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
}

function broadcast(room: Room, sender: WebSocket, message: Uint8Array): void {
  for (const client of room.clients) {
    if (client !== sender) {
      send(client, message);
    }
  }
}

export async function handleConnection(
  ws: WebSocket,
  roomId: string,
  userId: string,
  lastSeqId?: number,
): Promise<void> {
  const room = getRoom(roomId);
  room.clients.add(ws);

  // Fetch role once — used for RBAC on every incoming message
  const userRole = await getUserRoomRole(userId, roomId);

  // Sync step 1: send server's state vector so client knows what we have
  const syncStep1Encoder = encoding.createEncoder();
  encoding.writeVarUint(syncStep1Encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncStep1Encoder, room.doc);
  send(ws, encoding.toUint8Array(syncStep1Encoder));

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

  // B7 — Reconnection replay: send every Y.js update the client missed
  if (lastSeqId !== undefined) {
    try {
      const missed = await getEventsSince(roomId, lastSeqId);
      for (const event of missed) {
        const b64 = event.payload?.update as string | undefined;
        if (!b64) continue;
        const update = Buffer.from(b64, 'base64');
        const replayEncoder = encoding.createEncoder();
        encoding.writeVarUint(replayEncoder, MESSAGE_SYNC);
        syncProtocol.writeUpdate(replayEncoder, new Uint8Array(update));
        send(ws, encoding.toUint8Array(replayEncoder));
      }
    } catch (err) {
      console.error('[replay] failed to send missed events:', err);
    }
  }

  // Doc update handler — broadcast binary delta to all other clients + persist to event log
  const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === ws) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    broadcast(room, ws, encoding.toUint8Array(encoder));

    const originTag = typeof origin === 'string' ? origin : undefined;
    const nodeMatch = originTag?.match(/^node:([^:]+):(.+)$/);
    const eventType = nodeMatch ? nodeMatch[2] : (originTag ?? 'doc_update');
    const nodeId = nodeMatch ? nodeMatch[1] : null;
    logEvent({
      roomId,
      userId,
      eventType,
      nodeId,
      payload: { update: Buffer.from(update).toString('base64') },
    }).catch((err) => console.error('event-log error:', err));
  };

  // Awareness update handler — broadcast presence changes
  const awarenessUpdateHandler = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === ws) return;
    const changedClients = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients),
    );
    broadcast(room, ws, encoding.toUint8Array(encoder));
  };

  room.doc.on('update', docUpdateHandler);
  room.awareness.on('update', awarenessUpdateHandler);

  ws.on('message', (data: Buffer) => {
    const message = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    // Peek at message type + sync subtype without consuming the main decoder
    const peek = decoding.createDecoder(message);
    const msgType = decoding.readVarUint(peek);

    if (msgType === MESSAGE_SYNC) {
      const syncSubtype = decoding.readVarUint(peek);

      // B8 — RBAC: SYNC_STEP_1 is read-only (just a state-vector request); step2 + update carry mutations
      if (syncSubtype !== SYNC_STEP_1 && !canMutate(userRole)) {
        return; // viewer or non-member — drop the mutation
      }

      const decoder = decoding.createDecoder(message);
      decoding.readVarUint(decoder); // skip MESSAGE_SYNC header
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
      if (encoding.length(encoder) > 1) {
        send(ws, encoding.toUint8Array(encoder));
      }
    } else if (msgType === MESSAGE_AWARENESS) {
      const decoder = decoding.createDecoder(message);
      decoding.readVarUint(decoder); // skip MESSAGE_AWARENESS header
      awarenessProtocol.applyAwarenessUpdate(
        room.awareness,
        decoding.readVarUint8Array(decoder),
        ws,
      );
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    room.doc.off('update', docUpdateHandler);
    room.awareness.off('update', awarenessUpdateHandler);
    awarenessProtocol.removeAwarenessStates(room.awareness, [room.doc.clientID], userId);

    if (room.clients.size === 0) {
      room.doc.destroy();
      rooms.delete(roomId);
    }
  });
}
