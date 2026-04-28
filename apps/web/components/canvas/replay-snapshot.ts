'use client';

/**
 * Replay snapshot derivation for A11.
 *
 * Given a recorded event log, build a list of NodeSnapshots representing the
 * canvas at a particular index by:
 *   1. Creating a fresh Y.Doc
 *   2. Applying the baseline encoded state
 *   3. Applying each recorded update in order, up to and including index N
 *   4. Reading out the `nodes` Y.Map and converting to NodeSnapshots
 *
 * For replay scrubs across many indices, callers should reuse a single
 * `ReplayDoc` (created via `createReplayDoc`) and call `seekTo(index)`,
 * which incrementally applies/rebuilds rather than always recomputing from
 * scratch. Going forward we apply incremental updates; going backward we
 * reset and replay from baseline (Y.js updates are not invertible without
 * snapshots, so this is the only option).
 */

import * as Y from 'yjs';
import type { NodeSnapshot, RecordedEvent, StrokePoint } from '@/lib/types';

function snapshotFromYMap(id: string, m: Y.Map<unknown>): NodeSnapshot {
    const contentVal = m.get('content');
    const content =
        contentVal instanceof Y.Text ? contentVal.toString() : String(contentVal ?? '');

    const pointsVal = m.get('points');
    const points: StrokePoint[] =
        pointsVal instanceof Y.Array
            ? (pointsVal.toArray() as StrokePoint[])
            : [];

    const commentsVal = m.get('comments');
    const commentCount = commentsVal instanceof Y.Array ? commentsVal.length : 0;

    return {
        id,
        type: (m.get('type') as NodeSnapshot['type']) ?? 'sticky',
        x: Number(m.get('x') ?? 0),
        y: Number(m.get('y') ?? 0),
        w: Number(m.get('w') ?? 200),
        h: Number(m.get('h') ?? 160),
        content,
        color: String(m.get('color') ?? '#fde68a'),
        authorId: String(m.get('authorId') ?? 'anon'),
        acl: (m.get('acl') as NodeSnapshot['acl']) ?? 'all',
        classification:
            (m.get('classification') as NodeSnapshot['classification']) ?? null,
        taskId: (m.get('taskId') as string | null) ?? null,
        points,
        strokeWidth: Number(m.get('strokeWidth') ?? 3),
        fontSize: Number(m.get('fontSize') ?? 14),
        fill: ((m.get('fill') as NodeSnapshot['fill']) ?? 'solid'),
        lineDir: ((m.get('lineDir') as NodeSnapshot['lineDir']) ?? 'tl-br'),
        commentCount,
        createdAt: Number(m.get('createdAt') ?? 0),
        updatedAt: Number(m.get('updatedAt') ?? 0),
    };
}

function snapshotsFromDoc(doc: Y.Doc): NodeSnapshot[] {
    const nodes = doc.getMap<Y.Map<unknown>>('nodes');
    const out: NodeSnapshot[] = [];
    nodes.forEach((m, id) => {
        if (m instanceof Y.Map) out.push(snapshotFromYMap(id, m));
    });
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
}

export interface ReplayDoc {
    /** Currently materialised event index (0 = baseline only). */
    currentIndex: number;
    /** Underlying ghost doc — DO NOT mutate from outside. */
    doc: Y.Doc;
    /**
     * Move the ghost doc to represent state at `index` and return the
     * resulting NodeSnapshots. `index` is clamped to [0, events.length].
     */
    seekTo: (index: number, baseline: Uint8Array, events: RecordedEvent[]) => NodeSnapshot[];
    /** Tear down the ghost doc. */
    destroy: () => void;
}

export function createReplayDoc(baseline: Uint8Array): ReplayDoc {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, baseline, 'replay-render');

    const state: ReplayDoc = {
        currentIndex: 0,
        doc,
        seekTo(index, currentBaseline, events) {
            const target = Math.max(0, Math.min(index, events.length));

            // If going backward, we must rebuild from baseline because Y.js
            // updates are not invertible without a per-step snapshot.
            if (target < state.currentIndex) {
                // Replace the entire doc state with baseline by destroying
                // and recreating internally — but Y.Doc has no reset; we
                // use the trick of swapping in a fresh doc.
                state.doc.destroy();
                state.doc = new Y.Doc();
                Y.applyUpdate(state.doc, currentBaseline, 'replay-render');
                state.currentIndex = 0;
            }

            // Forward apply.
            for (let i = state.currentIndex; i < target; i++) {
                const ev = events[i];
                if (!ev) break;
                Y.applyUpdate(state.doc, ev.update, 'replay-render');
            }
            state.currentIndex = target;
            return snapshotsFromDoc(state.doc);
        },
        destroy() {
            state.doc.destroy();
        },
    };
    return state;
}
