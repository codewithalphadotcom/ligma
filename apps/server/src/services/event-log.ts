import { and, asc, eq, gt } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { events } from '@/db/schema.js';
import type { Event as EventRow } from '@/db/schema.js';

interface LogEventParams {
  roomId: string;
  userId: string;
  eventType: string;
  nodeId: string | null;
  payload: Record<string, unknown>;
}

export type { EventRow };

// `events.room_id` and `events.user_id` are Postgres `uuid` columns; any
// non-UUID input throws `22P02 invalid input syntax for type uuid` and
// crashes the WebSocket handler. Ephemeral rooms / guests legitimately
// produce non-UUID identifiers, so we drop those rows silently here.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logEvent(params: LogEventParams): Promise<EventRow | null> {
  const { roomId, userId, eventType, nodeId, payload } = params;
  if (!UUID_RE.test(roomId) || !UUID_RE.test(userId)) return null;
  const [row] = await db
    .insert(events)
    .values({ roomId, userId, eventType, nodeId, payload })
    .returning();
  if (!row) throw new Error('logEvent: insert returned no row');
  return row;
}

export async function getEventsSince(roomId: string, lastSeqId: number): Promise<EventRow[]> {
  if (!UUID_RE.test(roomId)) return [];
  return db
    .select()
    .from(events)
    .where(and(eq(events.roomId, roomId), gt(events.seqId, lastSeqId)))
    .orderBy(asc(events.seqId));
}
