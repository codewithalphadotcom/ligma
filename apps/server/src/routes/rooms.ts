import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { rooms, roomMembers, tasks, users } from '@/db/schema.js';
import auth from '@/middleware/auth.js';
import { ensureRoomMembership } from '@/services/rbac.js';
import { broadcastRoleChange } from '@/services/yjs-server.js';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const asyncHandler = (fn: AsyncFn): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();
router.use(auth);

// UUID format guard. Routes that pass `:id` straight into Postgres `uuid`
// columns crash if given non-UUID strings (e.g. `demo` from the landing
// page or share-link slugs). Reject those with a clean 404 so the client
// can fall back to the ephemeral / public-room code path.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requireUuidId: RequestHandler = (req, res, next) => {
  if (!UUID_RE.test(req.params.id ?? '')) {
    res.status(404).json({ error: 'room not found' });
    return;
  }
  next();
};

router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }

  const ownerId = req.user!.userId;
  const [room] = await db.insert(rooms).values({ name, ownerId }).returning();
  if (!room) throw new Error('insert returned no row');

  await db.insert(roomMembers).values({ roomId: room.id, userId: ownerId, role: 'lead' });

  return res.status(201).json({
    room: { id: room.id, name: room.name, ownerId: room.ownerId, createdAt: room.createdAt },
  });
}));

router.get('/:id', requireUuidId, asyncHandler(async (req, res) => {
  const roomId = req.params.id!;
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return res.status(404).json({ error: 'room not found' });

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      color: users.color,
      role: roomMembers.role,
    })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(eq(roomMembers.roomId, roomId));

  return res.status(200).json({
    room: { id: room.id, name: room.name, ownerId: room.ownerId, createdAt: room.createdAt },
    members,
  });
}));

router.patch('/:id/members', requireUuidId, asyncHandler(async (req, res) => {
  const roomId = req.params.id!;
  const callerId = req.user!.userId;

  const [caller] = await db
    .select({ role: roomMembers.role })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, callerId)))
    .limit(1);
  if (caller?.role !== 'lead') {
    return res.status(403).json({ error: 'only leads can manage members' });
  }

  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' });
  if (role !== 'lead' && role !== 'contributor' && role !== 'viewer') {
    return res.status(400).json({ error: 'invalid role' });
  }

  await db
    .insert(roomMembers)
    .values({ roomId, userId, role })
    .onConflictDoUpdate({
      target: [roomMembers.roomId, roomMembers.userId],
      set: { role },
    });

  // Propagate to every connected client in the room (and invalidate
  // server-side role caches) so live demotion takes effect without a
  // reconnect — even when the role change came in via REST instead of
  // through the in-app Members panel.
  broadcastRoleChange(roomId);

  return res.status(200).json({ ok: true });
}));

router.get('/:id/tasks', requireUuidId, asyncHandler(async (req, res) => {
  const roomId = req.params.id!;
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.roomId, roomId))
    .orderBy(asc(tasks.createdAt));
  return res.status(200).json({ tasks: rows });
}));

/**
 * GET /rooms — list rooms the caller is a member of (newest first).
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      ownerId: rooms.ownerId,
      createdAt: rooms.createdAt,
      role: roomMembers.role,
    })
    .from(rooms)
    .innerJoin(roomMembers, eq(roomMembers.roomId, rooms.id))
    .where(eq(roomMembers.userId, userId))
    .orderBy(desc(rooms.createdAt));
  return res.status(200).json({ rooms: rows });
}));

/**
 * POST /rooms/:id/join — idempotently add the caller as a contributor.
 * Returns the room metadata + the resolved role. Used by share-link joins.
 */
router.post('/:id/join', requireUuidId, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const roomId = req.params.id!;
  const role = await ensureRoomMembership(userId, roomId, 'contributor');
  if (!role) return res.status(404).json({ error: 'room not found' });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return res.status(404).json({ error: 'room not found' });

  return res.status(200).json({
    room: { id: room.id, name: room.name, ownerId: room.ownerId, createdAt: room.createdAt },
    role,
  });
}));

export default router;
