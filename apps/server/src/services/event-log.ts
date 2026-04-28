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

export async function logEvent(params: LogEventParams): Promise<EventRow> {
  const { roomId, userId, eventType, nodeId, payload } = params;
  const [row] = await db
    .insert(events)
    .values({ roomId, userId, eventType, nodeId, payload })
    .returning();
  if (!row) throw new Error('logEvent: insert returned no row');
  return row;
}

export async function getEventsSince(roomId: string, lastSeqId: number): Promise<EventRow[]> {
  return db
    .select()
    .from(events)
    .where(and(eq(events.roomId, roomId), gt(events.seqId, lastSeqId)))
    .orderBy(asc(events.seqId));
}
