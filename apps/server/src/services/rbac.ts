import { query } from '@/db/client.js';

export async function getUserRoomRole(userId: string, roomId: string): Promise<string | null> {
  const result = await query(
    'SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId],
  );
  return (result.rows[0]?.role as string) ?? null;
}

export function canMutate(role: string | null): boolean {
  return role === 'lead' || role === 'contributor';
}
