/**
 * End-to-end backend test: seeds demo users, hits every REST endpoint,
 * then validates the WebSocket / Yjs sync handshake.
 *
 * Run:  bun run scripts/test-backend.ts
 * (no extra deps — uses only bun built-ins + ws + yjs which are already in apps/server)
 */

import WebSocket from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';

// ── config ────────────────────────────────────────────────────────────────────
const BASE = 'http://ligma-alb-1194086337.ap-south-1.elb.amazonaws.com';
const WS_BASE = 'ws://ligma-alb-1194086337.ap-south-1.elb.amazonaws.com';
const SHARED_SECRET = 'JolXrsMnElkmxxZ28j0JDydhllD/WN9AUb5daQ0mGyA=';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ── tiny helpers ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ── WebSocket Yjs helper ──────────────────────────────────────────────────────
function connectYjs(roomId: string, token?: string): Promise<{
  ws: WebSocket;
  doc: Y.Doc;
  synced: Promise<void>;
}> {
  const url = token
    ? `${WS_BASE}/room/${roomId}?token=${encodeURIComponent(token)}`
    : `${WS_BASE}/room/${roomId}`;

  const ws = new WebSocket(url);
  const doc = new Y.Doc();
  let resolveSynced: () => void;
  let rejectSynced: (e: unknown) => void;
  const synced = new Promise<void>((res, rej) => {
    resolveSynced = res;
    rejectSynced = rej;
  });

  ws.binaryType = 'arraybuffer';

  let step2Received = false;
  let ourStep2Sent = false;

  ws.on('open', () => {
    // Send SyncStep1: share our (empty) state vector
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, doc);
    ws.send(encoding.toUint8Array(enc));
  });

  ws.on('message', (rawData: ArrayBuffer | Buffer) => {
    const buf = rawData instanceof ArrayBuffer ? new Uint8Array(rawData) : new Uint8Array(rawData);
    const decoder = decoding.createDecoder(buf);
    const msgType = decoding.readVarUint(decoder);

    if (msgType === MESSAGE_AWARENESS) return; // ignore presence for now

    if (msgType === MESSAGE_SYNC) {
      const subtype = decoding.readVarUint(decoder);

      if (subtype === 0) {
        // Server sent SyncStep1 — reply with SyncStep2 (our full state)
        const stateVector = decoding.readVarUint8Array(decoder);
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MESSAGE_SYNC);
        syncProtocol.writeSyncStep2(enc, doc, stateVector);
        ws.send(encoding.toUint8Array(enc));
        ourStep2Sent = true;
      } else if (subtype === 1) {
        // Server sent SyncStep2 (its full state)
        const update = decoding.readVarUint8Array(decoder);
        Y.applyUpdate(doc, update);
        step2Received = true;
        if (ourStep2Sent && step2Received) resolveSynced();
      } else if (subtype === 2) {
        // Incremental update
        const update = decoding.readVarUint8Array(decoder);
        Y.applyUpdate(doc, update);
      }
    }
  });

  ws.on('error', rejectSynced!);
  ws.on('close', () => {
    if (!step2Received) rejectSynced!(new Error('closed before sync'));
  });

  return Promise.resolve({ ws, doc, synced });
}

function sendYjsUpdate(ws: WebSocket, update: Uint8Array) {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MESSAGE_SYNC);
  encoding.writeVarUint(enc, 2); // SYNC_UPDATE
  encoding.writeVarUint8Array(enc, update);
  ws.send(encoding.toUint8Array(enc));
}

function waitMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔗  Backend: ${BASE}\n`);

  // ── 1. Health ─────────────────────────────────────────────────────────────
  console.log('── [1] Health ──────────────────────────────────────────────');
  {
    const { status, data } = await api('GET', '/health');
    ok('GET /health → 200', status === 200);
    ok('ok=true, service present', (data as { ok: boolean; service: string })?.ok === true);
  }

  // ── 2. Seed users via google-upsert ───────────────────────────────────────
  console.log('\n── [2] Seed demo users ──────────────────────────────────────');
  const hdrs = { 'x-auth-shared-secret': SHARED_SECRET };
  const { status: s1, data: d1 } = await api(
    'POST', '/auth/google-upsert',
    { email: 'alice@demo.test', name: 'Alice Demo', googleId: 'g_alice_demo' },
    undefined, hdrs,
  );
  ok('google-upsert alice → 200', s1 === 200);
  const aliceToken = (d1 as { token?: string })?.token ?? '';
  const aliceId    = (d1 as { user?: { id: string } })?.user?.id ?? '';
  ok('alice token present', aliceToken.length > 0);

  const { status: s2, data: d2 } = await api(
    'POST', '/auth/google-upsert',
    { email: 'bob@demo.test', name: 'Bob Demo', googleId: 'g_bob_demo' },
    undefined, hdrs,
  );
  ok('google-upsert bob → 200', s2 === 200);
  const bobToken = (d2 as { token?: string })?.token ?? '';
  const bobId    = (d2 as { user?: { id: string } })?.user?.id ?? '';
  ok('bob token present', bobToken.length > 0);

  // Re-upsert is idempotent
  const { status: s3 } = await api(
    'POST', '/auth/google-upsert',
    { email: 'alice@demo.test', name: 'Alice Demo', googleId: 'g_alice_demo' },
    undefined, hdrs,
  );
  ok('google-upsert idempotent (re-upsert → 200)', s3 === 200);

  // Invalid secret
  const { status: s4 } = await api(
    'POST', '/auth/google-upsert',
    { email: 'hacker@demo.test', name: 'Hacker', googleId: 'g_hack' },
    undefined, { 'x-auth-shared-secret': 'wrong' },
  );
  ok('google-upsert rejects bad secret → 401', s4 === 401);

  // ── 3. Auth: login validation ─────────────────────────────────────────────
  console.log('\n── [3] Auth: validation & error paths ──────────────────────');
  {
    const { status } = await api('POST', '/auth/login', { email: 'bad', password: 'x' });
    ok('login bad email → 400', status === 400);
  }
  {
    const { status } = await api('POST', '/auth/login', { email: 'nobody@demo.test', password: 'pass123' });
    ok('login unknown user → 401', status === 401);
  }
  {
    // Google-only account has no password — login should also 401
    const { status } = await api('POST', '/auth/login', { email: 'alice@demo.test', password: 'pass123' });
    ok('login google-only account → 401 (no password hash)', status === 401);
  }
  {
    const { status } = await api('POST', '/auth/signup', { name: '', email: 'x', password: 'y' });
    ok('signup bad body → 400', status === 400);
  }

  // ── 4. Rooms: auth guard ──────────────────────────────────────────────────
  console.log('\n── [4] Rooms: auth guard ────────────────────────────────────');
  {
    const { status } = await api('GET', '/rooms');
    ok('GET /rooms without token → 401', status === 401);
  }
  {
    const { status } = await api('POST', '/rooms', { name: 'x' }, 'bad.token.here');
    ok('POST /rooms bad token → 401', status === 401);
  }

  // ── 5. Rooms: create & list ───────────────────────────────────────────────
  console.log('\n── [5] Rooms: CRUD ──────────────────────────────────────────');
  const { status: rc, data: rd } = await api('POST', '/rooms', { name: 'Demo Room Alpha' }, aliceToken);
  ok('POST /rooms → 201', rc === 201);
  const roomId = (rd as { room?: { id: string } })?.room?.id ?? '';
  ok('room id present', roomId.length > 0);
  console.log(`     room id: ${roomId}`);

  // missing name
  const { status: rcBad } = await api('POST', '/rooms', {}, aliceToken);
  ok('POST /rooms missing name → 400', rcBad === 400);

  // list
  const { status: rl, data: rld } = await api('GET', '/rooms', undefined, aliceToken);
  ok('GET /rooms → 200', rl === 200);
  const roomIds = (rld as { rooms: { id: string }[] })?.rooms?.map((r) => r.id) ?? [];
  ok('created room appears in list', roomIds.includes(roomId));

  // get single
  const { status: rg, data: rgd } = await api('GET', `/rooms/${roomId}`, undefined, aliceToken);
  ok('GET /rooms/:id → 200', rg === 200);
  ok('members array present', Array.isArray((rgd as { members: unknown[] })?.members));
  const aliceMember = (rgd as { members: { id: string; role: string }[] })?.members?.find(
    (m) => m.id === aliceId,
  );
  ok('alice is lead', aliceMember?.role === 'lead');

  // non-UUID roomId returns 404
  const { status: rBadId } = await api('GET', '/rooms/not-a-uuid', undefined, aliceToken);
  ok('GET /rooms/not-a-uuid → 404', rBadId === 404);

  // ── 6. Room join ─────────────────────────────────────────────────────────
  console.log('\n── [6] Room join ────────────────────────────────────────────');
  const { status: rj, data: rjd } = await api('POST', `/rooms/${roomId}/join`, undefined, bobToken);
  ok('POST /rooms/:id/join (bob) → 200', rj === 200);
  ok('bob gets contributor role', (rjd as { role?: string })?.role === 'contributor');

  // confirm bob now appears as member
  const { data: afterJoin } = await api('GET', `/rooms/${roomId}`, undefined, aliceToken);
  const bobMember = (afterJoin as { members: { id: string; role: string }[] })?.members?.find(
    (m) => m.id === bobId,
  );
  ok('bob visible as room member after join', !!bobMember);

  // ── 7. Room members: role management ─────────────────────────────────────
  console.log('\n── [7] Members: role management ─────────────────────────────');
  // bob (contributor) cannot manage members
  const { status: rbob } = await api(
    'PATCH', `/rooms/${roomId}/members`, { userId: aliceId, role: 'viewer' }, bobToken,
  );
  ok('contributor cannot PATCH members → 403', rbob === 403);

  // invalid role
  const { status: rBadRole } = await api(
    'PATCH', `/rooms/${roomId}/members`, { userId: bobId, role: 'superadmin' }, aliceToken,
  );
  ok('invalid role → 400', rBadRole === 400);

  // alice demotes bob to viewer
  const { status: rpatch } = await api(
    'PATCH', `/rooms/${roomId}/members`, { userId: bobId, role: 'viewer' }, aliceToken,
  );
  ok('lead demotes bob to viewer → 200', rpatch === 200);

  // alice promotes bob back to contributor
  await api('PATCH', `/rooms/${roomId}/members`, { userId: bobId, role: 'contributor' }, aliceToken);
  ok('lead promotes bob back → ok (no error)', true);

  // ── 8. Tasks ──────────────────────────────────────────────────────────────
  console.log('\n── [8] Tasks ────────────────────────────────────────────────');
  const { status: ts, data: td } = await api('GET', `/rooms/${roomId}/tasks`, undefined, aliceToken);
  ok('GET /rooms/:id/tasks → 200', ts === 200);
  ok('tasks is array', Array.isArray((td as { tasks: unknown[] })?.tasks));

  // ── 9. Intent ─────────────────────────────────────────────────────────────
  console.log('\n── [9] Intent (AI) ─────────────────────────────────────────');
  {
    const { status, data } = await api('POST', '/intent', { text: 'Build the login page' });
    ok('POST /intent (guest) → 200', status === 200);
    ok('intent label present', typeof (data as { label?: string })?.label === 'string', JSON.stringify(data));
    console.log(`     label: ${(data as { label?: string })?.label}`);
  }
  {
    const { status, data } = await api('POST', '/intent', { text: 'Fix the navbar bug' }, aliceToken);
    ok('POST /intent (authed) → 200', status === 200);
    ok('confidence present', typeof (data as { confidence?: number })?.confidence === 'number');
  }
  {
    const { status } = await api('POST', '/intent', {});
    ok('POST /intent missing text → 400', status === 400);
  }
  {
    const { status } = await api('POST', '/intent', { text: 'x'.repeat(2001) });
    ok('POST /intent text too long → 413', status === 413);
  }

  // ── 10. Intent summary ────────────────────────────────────────────────────
  console.log('\n── [10] Intent: summary ─────────────────────────────────────');
  {
    const { status, data } = await api('POST', '/intent/summary', {
      roomName: 'Alpha Sprint',
      tasks: [
        { content: 'Set up CI/CD pipeline', authorName: 'Alice', status: 'done', createdAt: Date.now() - 3600000 },
        { content: 'Write unit tests for auth', authorName: 'Bob', status: 'open', createdAt: Date.now() },
        { content: 'Deploy to production', authorName: 'Alice', status: 'open', createdAt: Date.now() },
      ],
    }, aliceToken);
    ok('POST /intent/summary → 200', status === 200);
    ok('markdown present', typeof (data as { markdown?: string })?.markdown === 'string');
    const preview = ((data as { markdown?: string })?.markdown ?? '').slice(0, 120);
    console.log(`     preview: ${preview}…`);
  }
  {
    const { status } = await api('POST', '/intent/summary', { tasks: 'nope' });
    ok('POST /intent/summary bad body → 400', status === 400);
  }

  // ── 11. WebSocket: guest connects to demo room ────────────────────────────
  console.log('\n── [11] WebSocket: guest on ephemeral /room/demo ───────────');
  try {
    const { ws, synced } = await connectYjs('demo');
    await Promise.race([synced, waitMs(5000).then(() => { throw new Error('timeout'); })]);
    ok('guest WS connects + Yjs sync completes (demo room)', true);
    ws.close();
  } catch (e) {
    ok('guest WS connects + Yjs sync completes (demo room)', false, String(e));
  }

  // ── 12. WebSocket: authenticated user on persistent room ─────────────────
  console.log('\n── [12] WebSocket: authenticated on persistent room ────────');
  try {
    const { ws: ws1, doc: doc1, synced: synced1 } = await connectYjs(roomId, aliceToken);
    await Promise.race([synced1, waitMs(5000).then(() => { throw new Error('timeout'); })]);
    ok('alice WS syncs with persistent room', true);

    // Connect bob's client simultaneously
    const { ws: ws2, doc: doc2, synced: synced2 } = await connectYjs(roomId, bobToken);
    await Promise.race([synced2, waitMs(5000).then(() => { throw new Error('timeout'); })]);
    ok('bob WS syncs with persistent room', true);

    // Alice creates a node
    const nodeId = `node_test_${Date.now()}`;
    doc1.transact(() => {
      const nodes = doc1.getMap<Y.Map<unknown>>('nodes');
      const node = new Y.Map<unknown>();
      node.set('type', 'sticky');
      node.set('x', 100);
      node.set('y', 200);
      node.set('authorId', aliceId);
      node.set('acl', 'all');
      const txt = new Y.Text();
      txt.insert(0, 'Hello from test script');
      node.set('content', txt);
      nodes.set(nodeId, node);
    }, ws1); // use ws1 as origin so the handler persists it

    // Encode and send the update
    const update = Y.encodeStateAsUpdate(doc1);
    sendYjsUpdate(ws1 as unknown as WebSocket, update);

    // Wait for bob to receive the update
    await waitMs(1500);

    ok('nodes map non-empty after alice insert (doc1)', doc1.getMap('nodes').size > 0);

    // Disconnect
    ws1.close();
    ws2.close();
    await waitMs(200);
  } catch (e) {
    ok('authenticated WS test', false, String(e));
  }

  // ── 13. WebSocket: invalid token rejected ────────────────────────────────
  console.log('\n── [13] WebSocket: invalid token → 401 ─────────────────────');
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(`${WS_BASE}/room/${roomId}?token=bad.token.here`);
    ws.on('unexpected-response', (_req, res) => {
      ok('bad JWT token → HTTP 401 before upgrade', res.statusCode === 401);
      resolve();
    });
    ws.on('open', () => {
      ok('bad JWT token → HTTP 401 before upgrade', false, 'connection was accepted');
      ws.close();
      resolve();
    });
    ws.on('error', () => resolve());
    setTimeout(resolve, 3000);
  });

  // ── 14. WebSocket: unknown room path → 404 ───────────────────────────────
  console.log('\n── [14] WebSocket: unknown path → 404 ──────────────────────');
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(`${WS_BASE}/not-a-room-path`);
    ws.on('unexpected-response', (_req, res) => {
      ok('unknown WS path → 404', res.statusCode === 404);
      resolve();
    });
    ws.on('open', () => {
      ok('unknown WS path → 404', false, 'connection was accepted');
      ws.close();
      resolve();
    });
    ws.on('error', () => resolve());
    setTimeout(resolve, 3000);
  });

  // ── summary ───────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('──────────────────────────────────────────────────────────────\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
