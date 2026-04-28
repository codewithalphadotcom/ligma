import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { rooms, roomMembers } from '@/db/schema.js';

export type RoomRole = 'lead' | 'contributor' | 'viewer';
export type NodeAcl = 'lead-only' | 'contributor+' | 'all';

export async function getUserRoomRole(userId: string, roomId: string): Promise<RoomRole | null> {
  const [row] = await db
    .select({ role: roomMembers.role })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

/**
 * Idempotently ensure the user is a member of the room.
 *
 * - If they are not a member yet, insert as the supplied default role
 *   (defaults to `contributor`, which matches the share-link join flow).
 * - If they already are a member, the existing role is preserved (the row
 *   is left untouched) and that role is returned.
 *
 * Returns the resolved role, or `null` if the room does not exist.
 */
export async function ensureRoomMembership(
  userId: string,
  roomId: string,
  defaultRole: RoomRole = 'contributor',
): Promise<RoomRole | null> {
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return null;

  // ON CONFLICT DO UPDATE that updates `role` to its existing value is the
  // canonical idempotent upsert: it always returns the post-insert/update
  // row, but never overwrites an existing role.
  const [row] = await db
    .insert(roomMembers)
    .values({ roomId, userId, role: defaultRole })
    .onConflictDoUpdate({
      target: [roomMembers.roomId, roomMembers.userId],
      set: { role: sql`${roomMembers.role}` },
    })
    .returning({ role: roomMembers.role });

  return row?.role ?? null;
}

export function canMutate(role: RoomRole | null): boolean {
  return role === 'lead' || role === 'contributor';
}

/**
 * Per-node ACL gate. Mirrors `apps/web/lib/acl.ts#canEditNode` so server and
 * client agree on edit eligibility. Server is the source of truth — judging
 * scenario: a Contributor crafts a raw WebSocket update mutating a
 * `lead-only` node; this function returns `false` and the update is dropped.
 */
export function canEditNode(role: RoomRole | null, acl: NodeAcl): boolean {
  if (acl === 'all') return role === 'lead' || role === 'contributor';
  if (acl === 'contributor+') return role === 'lead' || role === 'contributor';
  if (acl === 'lead-only') return role === 'lead';
  return false;
}
