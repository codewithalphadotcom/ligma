import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { query } from '@/db/client.js';
import auth from '@/middleware/auth.js';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const asyncHandler = (fn: AsyncFn): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next);

const router = Router();
router.use(auth);

router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }

  const ownerId = req.user!.userId;
  const roomResult = await query(
    'INSERT INTO rooms (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at',
    [name, ownerId],
  );
  const room = roomResult.rows[0];

  await query(
    'INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)',
    [room.id, ownerId, 'lead'],
  );

  return res.status(201).json({
    room: { id: room.id, name: room.name, ownerId: room.owner_id, createdAt: room.created_at },
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const roomResult = await query(
    'SELECT id, name, owner_id, created_at FROM rooms WHERE id = $1',
    [req.params.id],
  );
  if (!roomResult.rows[0]) return res.status(404).json({ error: 'room not found' });
  const r = roomResult.rows[0];

  const membersResult = await query(
    `SELECT u.id, u.name, u.email, u.color, rm.role
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = $1`,
    [req.params.id],
  );

  return res.status(200).json({
    room: { id: r.id, name: r.name, ownerId: r.owner_id, createdAt: r.created_at },
    members: membersResult.rows,
  });
}));

router.patch('/:id/members', asyncHandler(async (req, res) => {
  const callerCheck = await query(
    'SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2',
    [req.params.id, req.user!.userId],
  );
  if (callerCheck.rows[0]?.role !== 'lead') {
    return res.status(403).json({ error: 'only leads can manage members' });
  }

  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' });

  await query(
    `INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, userId, role],
  );

  return res.status(200).json({ ok: true });
}));

router.get('/:id/tasks', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM tasks WHERE room_id = $1 ORDER BY created_at ASC',
    [req.params.id],
  );
  return res.status(200).json({ tasks: result.rows });
}));

export default router;
