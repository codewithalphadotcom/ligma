import { pool } from '../db';

interface LogEventParams {
  roomId: string;
  userId: string;
  eventType: string;
  nodeId: string | null;
  payload: Record<string, unknown>;
}

interface EventRow {
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
    [roomId, userId, eventType, nodeId, payload],
  );
  return rows[0];
}
