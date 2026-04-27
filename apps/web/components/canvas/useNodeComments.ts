'use client';

/**
 * useNodeComments — subscribe to a node's comments Y.Array and expose a
 * stable list of NodeComment for React rendering.
 *
 * Returns an empty array if the node id is null or the node has no
 * comments-array yet (e.g. legacy nodes).
 */

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import type { NodeComment } from '@/lib/types';

export function useNodeComments(
    yNodes: Y.Map<Y.Map<unknown>> | null,
    nodeId: string | null,
): NodeComment[] {
    const [comments, setComments] = useState<NodeComment[]>([]);

    useEffect(() => {
        if (!yNodes || !nodeId) {
            setComments([]);
            return;
        }
        const m = yNodes.get(nodeId);
        if (!m) {
            setComments([]);
            return;
        }
        const arr = m.get('comments');
        if (!(arr instanceof Y.Array)) {
            setComments([]);
            return;
        }

        const recompute = () => {
            setComments(arr.toArray() as NodeComment[]);
        };
        recompute();
        arr.observe(recompute);
        return () => arr.unobserve(recompute);
    }, [yNodes, nodeId]);

    return comments;
}
