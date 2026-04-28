'use client';

/**
 * ShapeNode — A4 deliverable, extended for A8/A9/A10:
 *
 * Renders a rectangle or circle shape with optional inline text label.
 * Drag to reposition (RAF-coalesced). Double-click to edit the label.
 * Selection ring + lock chrome + comment chip via NodeChrome.
 *
 * Shape vs sticky:
 *   - shape has a transparent fill + visible border by default
 *   - circle uses border-radius: 9999px, rect uses 6px
 *   - selectable text label centred via flex
 */

import { memo, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { bindYTextToTextarea } from '@/lib/y-textarea-binding';
import type { NodeSnapshot, RoomRole } from '@/lib/types';
import { canEditNode } from '@/lib/acl';
import { getShapePoints } from '@/lib/shape-geometry';
import { useCanvasUI } from '@/lib/canvas-store';
import { setNodePosition, setNodeAcl } from './node-ops';
import { NodeChrome } from './NodeChrome';
import { ResizeHandles } from './ResizeHandles';

interface ShapeNodeProps {
    node: NodeSnapshot;
    yNodes: Y.Map<Y.Map<unknown>>;
    zoom: number;
    roomRole: RoomRole;
}

function ShapeNodeImpl({ node, yNodes, zoom, roomRole }: ShapeNodeProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [editing, setEditing] = useState(false);
    const canEdit = canEditNode(roomRole, node.acl);

    const selected = useCanvasUI((s) => s.selection.has(node.id));
    const selectOnly = useCanvasUI((s) => s.selectOnly);
    const toggleSelected = useCanvasUI((s) => s.toggleSelected);
    const setCommentOpen = useCanvasUI((s) => s.setCommentOpen);
    const isReplaying = useCanvasUI((s) => s.replayIndex !== null);

    useEffect(() => {
        if (!canEdit && editing) setEditing(false);
    }, [canEdit, editing]);

    useEffect(() => {
        if (!editing) return;
        const m = yNodes.get(node.id);
        if (!m) return;
        const ytext = m.get('content');
        if (!(ytext instanceof Y.Text)) return;
        const ta = textareaRef.current;
        if (!ta) return;
        const binding = bindYTextToTextarea(ytext, ta);
        ta.focus();
        const len = ta.value.length;
        try {
            ta.setSelectionRange(len, len);
        } catch {
            /* ignore */
        }
        return () => binding.destroy();
    }, [editing, node.id, yNodes]);

    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
    } | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingPos = useRef<{ x: number; y: number } | null>(null);

    function flushPending() {
        rafRef.current = null;
        const p = pendingPos.current;
        if (!p) return;
        setNodePosition(yNodes, node.id, p.x, p.y);
        pendingPos.current = null;
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        if (editing) return;
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
        if (isReplaying) {
            e.stopPropagation();
            return;
        }
        e.stopPropagation();

        if (e.shiftKey) toggleSelected(node.id);
        else selectOnly(node.id);

        if (!canEdit) return;

        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            origX: node.x,
            origY: node.y,
        };
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const nx = d.origX + (e.clientX - d.startX) / zoom;
        const ny = d.origY + (e.clientY - d.startY) / zoom;
        pendingPos.current = { x: nx, y: ny };
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(flushPending);
        }
    }

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        try {
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
        dragRef.current = null;
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            flushPending();
        }
    }

    function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
        if (!canEdit || isReplaying) return;
        // Lines and arrows are pure geometry — no label.
        if (node.type === 'line' || node.type === 'arrow') return;
        e.stopPropagation();
        setEditing(true);
    }

    const isOutline = node.fill === 'outline';
    const fillColor = isOutline ? 'transparent' : node.color;
    const strokeColor = isOutline ? node.color : 'rgba(20,15,10,0.55)';
    const strokeWidth = isOutline ? 2 : 1;

    // Build an SVG geometry node sized to the bounding box.
    const W = Math.max(1, node.w);
    const H = Math.max(1, node.h);
    const inset = strokeWidth / 2; // keep the stroke fully inside the bbox
    let geometry: React.ReactNode = null;
    switch (node.type) {
        case 'circle':
            geometry = (
                <ellipse
                    cx={W / 2}
                    cy={H / 2}
                    rx={Math.max(0, W / 2 - inset)}
                    ry={Math.max(0, H / 2 - inset)}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                />
            );
            break;
        case 'rect':
            geometry = (
                <rect
                    x={inset}
                    y={inset}
                    width={Math.max(0, W - strokeWidth)}
                    height={Math.max(0, H - strokeWidth)}
                    rx={6}
                    ry={6}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                />
            );
            break;
        case 'triangle':
        case 'diamond':
        case 'hexagon':
        case 'pentagon':
        case 'star':
        case 'parallelogram': {
            const pts = getShapePoints(node.type, W, H, inset);
            if (pts) {
                geometry = (
                    <polygon
                        points={pts}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                    />
                );
            }
            break;
        }
        case 'line':
        case 'arrow': {
            // Map lineDir to start/end corners of the bbox so the arrowhead
            // points in the same direction the user originally dragged.
            const lineStroke = node.color;
            const lineSW = 2;
            const corners: Record<
                'tl-br' | 'tr-bl' | 'bl-tr' | 'br-tl',
                [number, number, number, number]
            > = {
                'tl-br': [inset, inset, Math.max(inset, W - inset), Math.max(inset, H - inset)],
                'tr-bl': [Math.max(inset, W - inset), inset, inset, Math.max(inset, H - inset)],
                'bl-tr': [inset, Math.max(inset, H - inset), Math.max(inset, W - inset), inset],
                'br-tl': [Math.max(inset, W - inset), Math.max(inset, H - inset), inset, inset],
            };
            const [x1, y1, x2, y2] = corners[node.lineDir ?? 'tl-br'];
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
            const ux = dx / len;
            const uy = dy / len;
            const px = -uy;
            const py = ux;
            const headLen = Math.min(18, len * 0.4);
            const headW = Math.min(10, len * 0.22);
            const baseX = x2 - ux * headLen;
            const baseY = y2 - uy * headLen;
            const leftX = baseX + px * headW;
            const leftY = baseY + py * headW;
            const rightX = baseX - px * headW;
            const rightY = baseY - py * headW;
            geometry = (
                <g>
                    <line
                        x1={x1}
                        y1={y1}
                        x2={node.type === 'arrow' ? baseX : x2}
                        y2={node.type === 'arrow' ? baseY : y2}
                        stroke={lineStroke}
                        strokeWidth={lineSW}
                        strokeLinecap="round"
                    />
                    {node.type === 'arrow' && (
                        <polygon
                            points={`${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`}
                            fill={lineStroke}
                            stroke={lineStroke}
                            strokeWidth={lineSW}
                            strokeLinejoin="round"
                        />
                    )}
                </g>
            );
            break;
        }
        default:
            geometry = (
                <rect
                    x={inset}
                    y={inset}
                    width={Math.max(0, W - strokeWidth)}
                    height={Math.max(0, H - strokeWidth)}
                    rx={6}
                    ry={6}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                />
            );
            break;
    }

    return (
        <div
            data-node-id={node.id}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            className="absolute select-none transition-shadow hover:shadow-md"
            style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: node.w,
                height: node.h,
                cursor: editing ? 'text' : canEdit ? 'grab' : 'not-allowed',
                touchAction: 'none',
                opacity: canEdit ? 1 : 0.85,
            }}
        >
            <svg
                aria-hidden
                width={node.w}
                height={node.h}
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0"
                style={{ overflow: 'visible' }}
            >
                {geometry}
            </svg>
            <NodeChrome
                acl={node.acl}
                canEdit={canEdit}
                selected={selected}
                commentCount={node.commentCount}
                onCommentClick={() => setCommentOpen(node.id)}
                onAclChange={
                    roomRole === 'lead'
                        ? (next) => setNodeAcl(yNodes, node.id, next)
                        : undefined
                }
            />
            {selected && canEdit && !editing && (
                <ResizeHandles
                    node={node}
                    yNodes={yNodes}
                    zoom={zoom}
                    lockAspect={node.type === 'circle'}
                />
            )}
            {editing ? (
                <textarea
                    ref={textareaRef}
                    onBlur={() => setEditing(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            (e.target as HTMLTextAreaElement).blur();
                        }
                        e.stopPropagation();
                    }}
                    style={{
                        fontSize: node.fontSize,
                        lineHeight: 1.25,
                        // Pick a label color that contrasts the current fill.
                        color: isOutline ? node.color : labelInkOn(node.color),
                    }}
                    className="relative h-full w-full resize-none bg-transparent p-2 text-center font-sans outline-none placeholder:text-neutral-500"
                    placeholder="label…"
                />
            ) : node.type === 'line' || node.type === 'arrow' ? null : (
                <div
                    style={{
                        fontSize: node.fontSize,
                        lineHeight: 1.25,
                        color: isOutline ? node.color : labelInkOn(node.color),
                    }}
                    className="relative flex h-full w-full items-center justify-center p-2 text-center font-sans"
                >
                    {node.content || (
                        <span className="text-neutral-500 italic">
                            {canEdit ? 'Double-click to label' : ''}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export const ShapeNode = memo(ShapeNodeImpl);

/**
 * Pick an ink color that's readable on the given fill. Falls back to dark
 * ink for light fills and ivory for dark fills. Only called for `solid` fill
 * mode — for `outline`, the label always uses the chosen color directly.
 */
function labelInkOn(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return '#0b0906';
    const v = parseInt(m[1]!, 16);
    const r = (v >> 16) & 0xff;
    const g = (v >> 8) & 0xff;
    const b = v & 0xff;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    return lum > 150 ? '#0b0906' : '#ede4d0';
}

