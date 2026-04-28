'use client';

/**
 * useYNodes — subscribe to the room's nodes Y.Map and expose a stable list of
 * NodeSnapshots for React rendering. Re-renders only when the set of node
 * IDs OR any field on a node changes (deep observe).
 */

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import type { NodeSnapshot, StrokePoint } from '@/lib/types';

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
        classification: (m.get('classification') as NodeSnapshot['classification']) ?? null,
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

export function useYNodes(nodes: Y.Map<Y.Map<unknown>> | null): NodeSnapshot[] {
    const [list, setList] = useState<NodeSnapshot[]>([]);

    useEffect(() => {
        if (!nodes) return;

        const recompute = () => {
            const out: NodeSnapshot[] = [];
            nodes.forEach((m, id) => {
                if (m instanceof Y.Map) out.push(snapshotFromYMap(id, m));
            });
            // Stable order: createdAt asc → newer nodes render on top via z-index.
            out.sort((a, b) => a.createdAt - b.createdAt);
            setList(out);
        };

        recompute();
        // observeDeep so changes inside a node's Y.Map (x/y/content) also fire.
        nodes.observeDeep(recompute);
        return () => {
            nodes.unobserveDeep(recompute);
        };
    }, [nodes]);

    return list;
}
