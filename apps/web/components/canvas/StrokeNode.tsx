'use client';

/**
 * StrokeNode — renders one freehand stroke as an SVG path.
 *
 * Strokes are intentionally non-editable — like ink, once down they don't
 * change. They CAN however be:
 *   - selected (click on the stroke, or marquee-overlap)
 *   - deleted (Delete/Backspace once selected; A8)
 *   - read-only when ACL is locked beyond the user's role (A9)
 *
 * The visible path has `pointer-events: none` so it never blocks node
 * interactions underneath. A second invisible path with a wider stroke acts
 * as a fat hit target so the user doesn't have to be pixel-perfect.
 *
 * Selection is shown via a soft glow on the visible path (`drop-shadow`
 * filter), since wrapping a path in a ring would require computing a bbox.
 */

import { memo } from 'react';
import type { NodeSnapshot, RoomRole } from '@/lib/types';
import { canEditNode } from '@/lib/acl';
import { useCanvasUI } from '@/lib/canvas-store';

interface StrokeNodeProps {
    node: NodeSnapshot;
    roomRole: RoomRole;
}

function buildPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    const first = points[0]!;
    let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
        const p = points[i]!;
        d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
    return d;
}

function StrokeNodeImpl({ node, roomRole }: StrokeNodeProps) {
    const selected = useCanvasUI((s) => s.selection.has(node.id));
    const selectOnly = useCanvasUI((s) => s.selectOnly);
    const toggleSelected = useCanvasUI((s) => s.toggleSelected);
    const isReplaying = useCanvasUI((s) => s.replayIndex !== null);
    const canEdit = canEditNode(roomRole, node.acl);

    if (node.points.length === 0) return null;
    const d = buildPath(node.points);

    function onPointerDown(e: React.PointerEvent<SVGPathElement>) {
        if (e.button !== 0) return;
        if (isReplaying) {
            e.stopPropagation();
            return;
        }
        e.stopPropagation();
        if (e.shiftKey) toggleSelected(node.id);
        else selectOnly(node.id);
    }

    // Hit padding is in world pixels — make it generous so thin strokes are
    // still easy to click. Cap at 16 so giant brush strokes don't get a huge
    // dead-zone.
    const hitWidth = Math.max(node.strokeWidth + 8, 12);

    return (
        <svg
            data-node-id={node.id}
            className="absolute left-0 top-0"
            style={{ overflow: 'visible', pointerEvents: 'none' }}
            width={0}
            height={0}
            aria-label={canEdit ? 'Stroke' : 'Stroke (locked)'}
        >
            {/* Invisible fat hit-target. */}
            <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={hitWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onPointerDown={onPointerDown}
            />
            {/* Visible stroke. */}
            <path
                d={d}
                fill="none"
                stroke={node.color}
                strokeWidth={node.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    pointerEvents: 'none',
                    filter: selected
                        ? 'drop-shadow(0 0 2px #3b82f6) drop-shadow(0 0 4px #3b82f6)'
                        : undefined,
                    opacity: canEdit ? 1 : 0.6,
                }}
            />
        </svg>
    );
}

export const StrokeNode = memo(StrokeNodeImpl);

