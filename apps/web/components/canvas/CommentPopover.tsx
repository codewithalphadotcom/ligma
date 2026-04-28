'use client';

/**
 * CommentPopover — A10 deliverable.
 *
 * Floats next to the currently-open node in *screen space* (so it stays the
 * same size regardless of zoom). Reads/writes the node's `comments` Y.Array
 * via `addComment` / `useNodeComments`.
 *
 * Per spec: anyone — including Viewers — can comment on locked nodes.
 *
 * Positioning:
 *   - The node lives in world space at (node.x, node.y, w, h)
 *   - Screen rect = (worldX * zoom + viewport.x, worldY * zoom + viewport.y,
 *                    w * zoom, h * zoom)
 *   - Popover anchors to the right of the node, clamped to viewport.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { X } from 'lucide-react';
import type { NodeSnapshot, Viewport } from '@/lib/types';
import { useCanvasUI } from '@/lib/canvas-store';
import { addComment } from './node-ops';
import { useNodeComments } from './useNodeComments';

interface CommentPopoverProps {
    yNodes: Y.Map<Y.Map<unknown>>;
    nodes: NodeSnapshot[];
    viewport: Viewport;
    /** Used to author new comments. */
    identity: { authorId: string; authorName: string; color: string };
    /** Container that defines viewport bounds for clamping. */
    canvasBounds: DOMRect | null;
}

const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 360;

function formatTimeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(ts).toLocaleDateString();
}

export function CommentPopover({
    yNodes,
    nodes,
    viewport,
    identity,
    canvasBounds,
}: CommentPopoverProps) {
    const openId = useCanvasUI((s) => s.commentOpenId);
    const setCommentOpen = useCanvasUI((s) => s.setCommentOpen);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const listEndRef = useRef<HTMLDivElement | null>(null);

    const node = useMemo(
        () => (openId ? nodes.find((n) => n.id === openId) ?? null : null),
        [openId, nodes],
    );

    const comments = useNodeComments(yNodes, openId);

    // Reset draft + focus input when opening a different node.
    useEffect(() => {
        if (!openId) return;
        setDraft('');
        const t = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(t);
    }, [openId]);

    // Auto-scroll to latest comment when new ones arrive.
    useEffect(() => {
        listEndRef.current?.scrollIntoView({ block: 'end' });
    }, [comments.length]);

    // Auto-close if the open node was deleted.
    useEffect(() => {
        if (openId && !node) setCommentOpen(null);
    }, [openId, node, setCommentOpen]);

    if (!openId || !node) return null;

    function submit() {
        if (!node) return;
        const text = draft.trim();
        if (!text) return;
        addComment(yNodes, node.id, {
            authorId: identity.authorId,
            authorName: identity.authorName,
            color: identity.color,
            text,
        });
        setDraft('');
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        // Don't bubble to canvas-level shortcuts.
        e.stopPropagation();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setCommentOpen(null);
        }
    }

    // ---- Position in screen space ----
    const nodeRight = node.x * viewport.zoom + viewport.x + node.w * viewport.zoom;
    const nodeTop = node.y * viewport.zoom + viewport.y;
    const bw = canvasBounds?.width ?? window.innerWidth;
    const bh = canvasBounds?.height ?? window.innerHeight;

    let left = nodeRight + 12;
    if (left + POPOVER_WIDTH > bw - 8) {
        // Flip to left side of node if it would overflow the canvas right edge.
        left = node.x * viewport.zoom + viewport.x - POPOVER_WIDTH - 12;
    }
    left = Math.max(8, Math.min(left, bw - POPOVER_WIDTH - 8));
    const top = Math.max(
        8,
        Math.min(nodeTop, bh - POPOVER_MAX_HEIGHT - 8),
    );

    return (
        <div
            role="dialog"
            aria-label="Comments"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className="absolute z-30 flex flex-col rounded-lg bg-white shadow-2xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10"
            style={{
                left,
                top,
                width: POPOVER_WIDTH,
                maxHeight: POPOVER_MAX_HEIGHT,
            }}
        >
            <header className="flex items-center justify-between border-b border-black/10 px-3 py-2 dark:border-white/10">
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Comments{' '}
                    <span className="text-neutral-500">({comments.length})</span>
                </div>
                <button
                    type="button"
                    onClick={() => setCommentOpen(null)}
                    aria-label="Close comments"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                    <X size={14} />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-2">
                {comments.length === 0 ? (
                    <p className="py-6 text-center text-xs text-neutral-500">
                        No comments yet. Be the first.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {comments.map((c) => (
                            <li
                                key={c.id}
                                className="rounded-md bg-neutral-50 p-2 text-xs dark:bg-neutral-800"
                            >
                                <div className="mb-1 flex items-center gap-1.5">
                                    <span
                                        aria-hidden
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: c.color }}
                                    />
                                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                        {c.authorName}
                                    </span>
                                    <span className="ml-auto text-[10px] text-neutral-500">
                                        {formatTimeAgo(c.createdAt)}
                                    </span>
                                </div>
                                <div className="whitespace-pre-wrap wrap-break-word text-neutral-800 dark:text-neutral-200">
                                    {c.text}
                                </div>
                            </li>
                        ))}
                        <div ref={listEndRef} />
                    </ul>
                )}
            </div>

            <footer className="border-t border-black/10 p-2 dark:border-white/10">
                <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Add a comment… (⌘+Enter)"
                    rows={2}
                    className="w-full resize-none rounded-md border border-black/10 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-blue-500 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <div className="mt-1 flex justify-end">
                    <button
                        type="button"
                        onClick={submit}
                        disabled={draft.trim().length === 0}
                        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Comment
                    </button>
                </div>
            </footer>
        </div>
    );
}
