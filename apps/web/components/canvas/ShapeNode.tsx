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
import { useCanvasUI } from '@/lib/canvas-store';
import { setNodePosition } from './node-ops';
import { NodeChrome } from './NodeChrome';

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
        e.stopPropagation();
        setEditing(true);
    }

    const isCircle = node.type === 'circle';
    const fill = node.color === 'transparent' ? 'rgba(255,255,255,0.001)' : node.color;

    return (
        <div
            data-node-id={node.id}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            className="absolute select-none ring-1 ring-black/10 transition-shadow hover:shadow-md"
            style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: node.w,
                height: node.h,
                backgroundColor: fill,
                border: '2px solid #1f2937', // slate-800
                borderRadius: isCircle ? '9999px' : '6px',
                cursor: editing ? 'text' : canEdit ? 'grab' : 'not-allowed',
                touchAction: 'none',
                opacity: canEdit ? 1 : 0.85,
            }}
        >
            <NodeChrome
                acl={node.acl}
                canEdit={canEdit}
                selected={selected}
                commentCount={node.commentCount}
                onCommentClick={() => setCommentOpen(node.id)}
            />
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
                    className="h-full w-full resize-none rounded-md bg-transparent p-2 text-center font-sans text-sm leading-snug text-neutral-900 outline-none placeholder:text-neutral-500"
                    placeholder="label…"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-sm leading-snug text-neutral-900">
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

