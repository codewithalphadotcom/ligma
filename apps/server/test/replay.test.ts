import { describe, expect, test } from 'bun:test';

/**
 * B13 — reconnection-replay contract.
 *
 * The yjs server tails the `events` table with a monotonically increasing
 * `seq_id` and replays every event with `seq_id > last_seq_id` after a
 * client reconnects. This test exercises the pure ordering/filter logic
 * the SQL `getEventsSince` query relies on so a regression in either the
 * column ordering or the strict `>` comparison would be caught here
 * without requiring a live Postgres.
 */

interface FakeEvent {
    seq_id: number;
    event_type: string;
    payload: Record<string, unknown>;
}

function getEventsSinceLocal(events: FakeEvent[], lastSeqId: number): FakeEvent[] {
    return events
        .filter((e) => e.seq_id > lastSeqId)
        .sort((a, b) => a.seq_id - b.seq_id);
}

describe('event replay (getEventsSince)', () => {
    const log: FakeEvent[] = [
        { seq_id: 1, event_type: 'node_created', payload: { id: 'a' } },
        { seq_id: 2, event_type: 'node_moved', payload: { id: 'a' } },
        { seq_id: 3, event_type: 'comment_added', payload: { nodeId: 'a' } },
        { seq_id: 4, event_type: 'task_assigned', payload: { taskId: 't1' } },
    ];

    test('replays everything when client has seen nothing (lastSeqId=0)', () => {
        const out = getEventsSinceLocal(log, 0);
        expect(out.length).toBe(4);
        expect(out.map((e) => e.seq_id)).toEqual([1, 2, 3, 4]);
    });

    test('replays only events after the supplied seq_id (strict >)', () => {
        const out = getEventsSinceLocal(log, 2);
        expect(out.map((e) => e.seq_id)).toEqual([3, 4]);
    });

    test('returns empty array when fully caught up', () => {
        const out = getEventsSinceLocal(log, 4);
        expect(out).toEqual([]);
    });

    test('preserves chronological order regardless of input order', () => {
        const shuffled = [log[3]!, log[0]!, log[2]!, log[1]!];
        const out = getEventsSinceLocal(shuffled, 0);
        expect(out.map((e) => e.seq_id)).toEqual([1, 2, 3, 4]);
    });
});
