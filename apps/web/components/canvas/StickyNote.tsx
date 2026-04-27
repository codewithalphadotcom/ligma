'use client';

/**
 * StickyNote — A3 deliverable, extended for A8/A9/A10:
 *
 * - Renders a sticky note from a NodeSnapshot.
 * - Inline edit via Y.Text-bound textarea (CRDT merge for concurrent typing).
 * - Drag to move (translates pointer delta into world space using `zoom`).
 * - Pointer-down also handles selection (single, shift-toggle).
 * - When the current user can't edit (ACL gate), drag + edit are disabled
 *   and a lock chrome is shown.
 * - Comment chip exposes A10's thread popover.
 * - Stops propagation so canvas pan doesn't fire during node interaction.
 */

import { memo, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { bindYTextToTextarea } from '@/lib/y-textarea-binding';
import type { NodeSnapshot, RoomRole } from '@/lib/types';
import { canEditNode } from '@/lib/acl';
import { useCanvasUI } from '@/lib/canvas-store';
import { setNodePosition } from './node-ops';
import { NodeChrome } from './NodeChrome';

interface StickyNoteProps {
    node: NodeSnapshot;
    yNodes: Y.Map<Y.Map<unknown>>;
    /** Current viewport zoom — needed to translate screen px → world px. */
    zoom: number;
    roomRole: RoomRole;
}

function StickyNoteImpl({ node, yNodes, zoom, roomRole }: StickyNoteProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [editing, setEditing] = useState(false);
    const canEdit = canEditNode(roomRole, node.acl);

    const selected = useCanvasUI((s) => s.selection.has(node.id));
    const selectOnly = useCanvasUI((s) => s.selectOnly);
    const toggleSelected = useCanvasUI((s) => s.toggleSelected);
    const setCommentOpen = useCanvasUI((s) => s.setCommentOpen);
    const isReplaying = useCanvasUI((s) => s.replayIndex !== null);

    // If a Viewer somehow had editing=true and the ACL flips, exit edit mode.
    useEffect(() => {
        if (!canEdit && editing) setEditing(false);
    }, [canEdit, editing]);

    // Bind the underlying Y.Text to the textarea while editing.
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
        // Move caret to end on first focus.
        const len = ta.value.length;
        try {
            ta.setSelectionRange(len, len);
        } catch {
            /* ignore */
        }
        return () => binding.destroy();
    }, [editing, node.id, yNodes]);

    // -- Drag-to-move --
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        moved: boolean;
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

        // Selection: shift-click toggles, plain click replaces.
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
            moved: false,
        };
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const dxScreen = e.clientX - d.startX;
        const dyScreen = e.clientY - d.startY;
        if (Math.abs(dxScreen) + Math.abs(dyScreen) > 2) d.moved = true;
        const nx = d.origX + dxScreen / zoom;
        const ny = d.origY + dyScreen / zoom;
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

    return (
        <div
            data-node-id={node.id}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            className="absolute select-none rounded-md shadow-lg ring-1 ring-black/5 transition-shadow hover:shadow-xl"
            style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: node.w,
                height: node.h,
                backgroundColor: node.color,
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
                        // Don't let key events bubble up to canvas-level shortcuts.
                        e.stopPropagation();
                    }}
                    className="h-full w-full resize-none rounded-md bg-transparent p-3 font-sans text-sm leading-snug text-neutral-900 outline-none placeholder:text-neutral-500"
                    placeholder="Type your note…"
                />
            ) : (
                <div className="flex h-full w-full flex-col p-3">
                    <div className="whitespace-pre-wrap break-words text-sm leading-snug text-neutral-900">
                        {node.content || (
                            <span className="text-neutral-500 italic">
                                {canEdit ? 'Double-click to edit' : 'Read-only'}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export const StickyNote = memo(StickyNoteImpl);

