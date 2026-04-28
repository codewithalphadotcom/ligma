'use client';

/**
 * ResizeHandles — eight (corner + edge) drag handles drawn around a selected
 * node. Each handle is fixed-size in screen space (we counter-scale by 1/zoom)
 * so they stay clickable at any zoom level.
 *
 * The handles update the node's bbox via `setNodeSize`. A min size of 20px
 * is enforced inside the node-op.
 *
 * Stroke nodes are not resizable (they're defined by their points), so the
 * caller decides whether to render this.
 */

import { useRef } from 'react';
import * as Y from 'yjs';
import { setNodeSize } from './node-ops';
import type { NodeSnapshot } from '@/lib/types';

interface ResizeHandlesProps {
    node: NodeSnapshot;
    yNodes: Y.Map<Y.Map<unknown>>;
    zoom: number;
    /** Set true for circles so corner drags stay square. */
    lockAspect?: boolean;
}

type HandlePos =
    | 'nw' | 'n' | 'ne'
    | 'w' | 'e'
    | 'sw' | 's' | 'se';

const HANDLES: HandlePos[] = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

const CURSOR: Record<HandlePos, string> = {
    nw: 'nwse-resize', se: 'nwse-resize',
    ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize',
    e: 'ew-resize', w: 'ew-resize',
};

export function ResizeHandles({
    node,
    yNodes,
    zoom,
    lockAspect = false,
}: ResizeHandlesProps) {
    const dragRef = useRef<{
        pointerId: number;
        handle: HandlePos;
        startClientX: number;
        startClientY: number;
        origX: number;
        origY: number;
        origW: number;
        origH: number;
        origFont: number;
    } | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingRect = useRef<{
        x: number;
        y: number;
        w: number;
        h: number;
        fontSize: number;
    } | null>(null);

    function flush() {
        rafRef.current = null;
        const r = pendingRect.current;
        if (!r) return;
        setNodeSize(yNodes, node.id, r);
        pendingRect.current = null;
    }

    function onDown(e: React.PointerEvent<HTMLDivElement>, handle: HandlePos) {
        if (e.button !== 0) return;
        // Don't let the parent node start a drag.
        e.stopPropagation();
        e.preventDefault();
        dragRef.current = {
            pointerId: e.pointerId,
            handle,
            startClientX: e.clientX,
            startClientY: e.clientY,
            origX: node.x,
            origY: node.y,
            origW: node.w,
            origH: node.h,
            origFont: node.fontSize || 14,
        };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    }

    function onMove(e: React.PointerEvent<HTMLDivElement>) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;

        // Convert screen-space delta to world-space delta by dividing by zoom.
        const dx = (e.clientX - d.startClientX) / zoom;
        const dy = (e.clientY - d.startClientY) / zoom;

        let nx = d.origX;
        let ny = d.origY;
        let nw = d.origW;
        let nh = d.origH;
        const h = d.handle;

        if (h.includes('e')) nw = d.origW + dx;
        if (h.includes('s')) nh = d.origH + dy;
        if (h.includes('w')) {
            nw = d.origW - dx;
            nx = d.origX + dx;
        }
        if (h.includes('n')) {
            nh = d.origH - dy;
            ny = d.origY + dy;
        }

        // Min-size clamp: if the user drags past the opposite edge we want
        // the bbox to stay anchored, not flip inside-out.
        const min = 20;
        if (nw < min) {
            if (h.includes('w')) nx = d.origX + d.origW - min;
            nw = min;
        }
        if (nh < min) {
            if (h.includes('n')) ny = d.origY + d.origH - min;
            nh = min;
        }

        // Lock aspect ratio for circles: take the larger dimension as canonical.
        if (lockAspect) {
            const s = Math.max(nw, nh);
            // Re-anchor so the handle the user is dragging stays under the cursor.
            if (h.includes('w')) nx = d.origX + d.origW - s;
            if (h.includes('n')) ny = d.origY + d.origH - s;
            nw = s;
            nh = s;
        }

        // Scale label font size with the box. Use the smaller of the two
        // axis ratios so text never overflows when the box gets thinner on
        // one side. Skip for stroke nodes (no font) — but ResizeHandles is
        // never rendered for them anyway.
        const scale = Math.min(nw / d.origW, nh / d.origH);
        const nextFont = Math.max(6, Math.min(512, d.origFont * scale));

        pendingRect.current = { x: nx, y: ny, w: nw, h: nh, fontSize: nextFont };
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(flush);
        }
    }

    function onUp(e: React.PointerEvent<HTMLDivElement>) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        try {
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
        dragRef.current = null;
        // Final flush in case there's a queued rAF that hasn't fired.
        if (pendingRect.current) {
            setNodeSize(yNodes, node.id, pendingRect.current);
            pendingRect.current = null;
        }
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }

    // Handles render OUTSIDE the node's bbox via offsets. Size is fixed in
    // screen pixels (we counter-scale by zoom).
    const HANDLE_PX = 10;
    const size = HANDLE_PX / zoom;
    const half = size / 2;

    function pos(h: HandlePos): { left: number; top: number } {
        const left = h.includes('w')
            ? -half
            : h.includes('e')
                ? node.w - half
                : node.w / 2 - half;
        const top = h.includes('n')
            ? -half
            : h.includes('s')
                ? node.h - half
                : node.h / 2 - half;
        return { left, top };
    }

    return (
        <>
            {HANDLES.map((h) => {
                const { left, top } = pos(h);
                return (
                    <div
                        key={h}
                        role="presentation"
                        onPointerDown={(e) => onDown(e, h)}
                        onPointerMove={onMove}
                        onPointerUp={onUp}
                        onPointerCancel={onUp}
                        className="absolute"
                        style={{
                            left,
                            top,
                            width: size,
                            height: size,
                            background: '#ede4d0',
                            border: `${1 / zoom}px solid #0b0906`,
                            borderRadius: 2 / zoom,
                            cursor: CURSOR[h],
                            // Keep handles above any node content / chrome.
                            zIndex: 10,
                            touchAction: 'none',
                        }}
                    />
                );
            })}
        </>
    );
}
