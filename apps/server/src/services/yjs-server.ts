import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { WebSocket } from 'ws';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

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

export function handleConnection(ws: WebSocket, roomId: string, userId: string): void {
  const room = getRoom(roomId);
  room.clients.add(ws);

  // Send sync step 1
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

  // Doc update handler — broadcast binary delta to all other clients
  const docUpdateHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === ws) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    broadcast(room, ws, encoding.toUint8Array(encoder));
  };

  // Awareness update handler
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

  ws.on('message', (data: Uint8Array) => {
    const message = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
      // If encoder has content beyond the message type byte, send it back (sync step 2 reply)
      if (encoding.length(encoder) > 1) {
        send(ws, encoding.toUint8Array(encoder));
      }
    } else if (messageType === MESSAGE_AWARENESS) {
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

    // Clean up empty rooms
    if (room.clients.size === 0) {
      room.doc.destroy();
      rooms.delete(roomId);
    }
  });
}
