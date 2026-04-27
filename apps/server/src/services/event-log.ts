import { pool } from '../db/client.js';

interface LogEventParams {
  roomId: string;
  userId: string;
  eventType: string;
  nodeId: string | null;
  payload: Record<string, unknown>;
}

export interface EventRow {
  id: number;
  seq_id: number;
  room_id: string;
  user_id: string;
  event_type: string;
  node_id: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

export async function logEvent(params: LogEventParams): Promise<EventRow> {
  const { roomId, userId, eventType, nodeId, payload } = params;
  const { rows } = await pool.query<EventRow>(
    `INSERT INTO events (room_id, user_id, event_type, node_id, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [roomId, userId, eventType, nodeId, JSON.stringify(payload)],
  );
  return rows[0];
}

export async function getEventsSince(roomId: string, lastSeqId: number): Promise<EventRow[]> {
  const { rows } = await pool.query<EventRow>(
    'SELECT * FROM events WHERE room_id = $1 AND seq_id > $2 ORDER BY seq_id ASC',
    [roomId, lastSeqId],
  );
  return rows;
}
