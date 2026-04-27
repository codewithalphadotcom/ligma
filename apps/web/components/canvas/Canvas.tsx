'use client';

/**
 * Canvas — A1/A4–A11 deliverable.
 *
 * Infinite, pan-and-zoom viewport. World content (nodes layer) is positioned
 * via a single CSS transform on the world container.
 *
 * Interaction model is **tool-aware** (see Toolbar):
 *   select  — pan via empty-canvas drag, marquee via shift+drag, click on
 *             a node selects it, click empty clears selection
 *   sticky  — click empty canvas to place a sticky note
 *   rect    — click empty canvas to place a rectangle
 *   circle  — click empty canvas to place a circle
 *   text    — click empty canvas to place a text block
 *   draw    — click+drag to draw a freehand stroke
 *
 * Pan is always available via Space-drag or middle-mouse, regardless of tool.
 *
 * A8 — Multi-select via shift-click (handled inside nodes) and shift-drag
 * marquee on empty canvas. Delete/Backspace deletes selection.
 *
 * A11 — When `replayIndex !== null`, the canvas swaps to read-only
 * ReplayNodeLayer fed by a derived snapshot, all editing is suppressed.
 *
 * Cursor presence is broadcast over Y.Awareness on every pointermove; remote
 * cursors are rendered by CursorLayer in screen space.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import { cn } from '@/lib/cn';
import {
    DEFAULT_VIEWPORT,
    SHAPE_DEFAULT_H,
    SHAPE_DEFAULT_W,
    STICKY_DEFAULT_H,
    STICKY_DEFAULT_W,
    TEXT_DEFAULT_H,
    TEXT_DEFAULT_W,
    ZOOM_MAX,
    ZOOM_MIN,
    type NodeSnapshot,
    type RoomRole,
    type Tool,
    type Viewport,
} from '@/lib/types';
import { useCanvasUI } from '@/lib/canvas-store';
import {
    appendStrokePoint,
    beginStrokeNode,
    createShapeNode,
    createStickyNode,
    createTextBlockNode,
    deleteNodes,
} from './node-ops';
import { canEditNode } from '@/lib/acl';
import { CanvasNodeLayer } from './CanvasNodeLayer';
import { ReplayNodeLayer } from './ReplayNodeLayer';
import { Toolbar } from './Toolbar';
import { CursorLayer } from './CursorLayer';
import { CommentPopover } from './CommentPopover';
import { TimelineReplay } from './TimelineReplay';
import { useAwareness } from './useAwareness';
import { useEventLog } from './useEventLog';
import { useReplaySnapshot } from './useReplaySnapshot';

interface Identity {
    authorId: string;
    authorName: string;
    color: string;
    roomRole: RoomRole;
}

interface CanvasProps {
    yNodes: Y.Map<Y.Map<unknown>>;
    nodes: NodeSnapshot[];
    identity: Identity;
    provider: WebsocketProvider;
}

const ZOOM_STEP = 1.1;
const ZOOM_WHEEL_SENSITIVITY = 0.0015;
const PAN_WHEEL_SENSITIVITY = 1;

interface MarqueeRect {
    /** All four in screen-space client coords. */
    sx0: number;
    sy0: number;
    sx1: number;
    sy1: number;
    /** True if shift was held at start (additive selection). */
    additive: boolean;
}

export function Canvas({ yNodes, nodes, identity, provider }: CanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
    const [canvasBounds, setCanvasBounds] = useState<DOMRect | null>(null);

    const tool = useCanvasUI((s) => s.tool);
    const setTool = useCanvasUI((s) => s.setTool);
    const selection = useCanvasUI((s) => s.selection);
    const selectOnly = useCanvasUI((s) => s.selectOnly);
    const selectMany = useCanvasUI((s) => s.selectMany);
    const addToSelection = useCanvasUI((s) => s.addToSelection);
    const clearSelection = useCanvasUI((s) => s.clearSelection);
    const setCommentOpen = useCanvasUI((s) => s.setCommentOpen);
    const replayIndex = useCanvasUI((s) => s.replayIndex);
    const isReplaying = replayIndex !== null;

    // Live refs so async handlers always read current state.
    const viewportRef = useRef(viewport);
    viewportRef.current = viewport;
    const spaceHeldRef = useRef(spaceHeld);
    spaceHeldRef.current = spaceHeld;
    const toolRef = useRef(tool);
    toolRef.current = tool;
    const isReplayingRef = useRef(isReplaying);
    isReplayingRef.current = isReplaying;
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    const selectionRef = useRef(selection);
    selectionRef.current = selection;

    const presence = useAwareness(provider);

    // ---- Event log + replay derivation (A11) ----
    const eventLog = useEventLog(provider);
    const replayNodes = useReplaySnapshot(
        replayIndex,
        eventLog.baseline,
        eventLog.events,
    );

    // Visible node list — switches to derived replay snapshot when scrubbing.
    const visibleNodes = useMemo(
        () => (isReplaying && replayNodes ? replayNodes : nodes),
        [isReplaying, replayNodes, nodes],
    );

    // ---- Coordinate helpers ----
    const screenToWorld = useCallback(
        (sx: number, sy: number): { x: number; y: number } => {
            const v = viewportRef.current;
            return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom };
        },
        [],
    );

    // Track container bounds for popover positioning + screen->world math.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => setCanvasBounds(el.getBoundingClientRect());
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener('scroll', update, true);
        return () => {
            ro.disconnect();
            window.removeEventListener('scroll', update, true);
        };
    }, []);

    // ---- Awareness: publish local user identity once ----
    useEffect(() => {
        const aw = provider.awareness;
        aw.setLocalStateField('user', {
            id: identity.authorId,
            name: identity.authorName,
            color: identity.color,
        });
        return () => {
            // Clear cursor on unmount so peers don't see a stale ghost.
            aw.setLocalStateField('cursor', null);
        };
    }, [provider, identity.authorId, identity.authorName, identity.color]);

    // ---- Wheel: pan or zoom ----
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        function handleWheel(e: WheelEvent) {
            e.preventDefault();
            const v = viewportRef.current;
            const isZoom = e.ctrlKey || e.metaKey;
            if (isZoom) {
                const rect = el!.getBoundingClientRect();
                const cx = e.clientX - rect.left;
                const cy = e.clientY - rect.top;
                const factor = Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY);
                const nextZoom = clamp(v.zoom * factor, ZOOM_MIN, ZOOM_MAX);
                const worldX = (cx - v.x) / v.zoom;
                const worldY = (cy - v.y) / v.zoom;
                setViewport({
                    x: cx - worldX * nextZoom,
                    y: cy - worldY * nextZoom,
                    zoom: nextZoom,
                });
            } else {
                setViewport({
                    x: v.x - e.deltaX * PAN_WHEEL_SENSITIVITY,
                    y: v.y - e.deltaY * PAN_WHEEL_SENSITIVITY,
                    zoom: v.zoom,
                });
            }
        }

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // ---- Keyboard: space-to-pan, +/-/0 zoom, Delete/Esc selection actions ----
    useEffect(() => {
        function isTyping(target: EventTarget | null): boolean {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
        }

        function onKeyDown(e: KeyboardEvent) {
            if (isTyping(e.target)) return;

            if (e.code === 'Space') {
                e.preventDefault();
                setSpaceHeld(true);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                clearSelection();
                setCommentOpen(null);
                if (toolRef.current !== 'select') setTool('select');
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (isReplayingRef.current) return;
                const sel = selectionRef.current;
                if (sel.size === 0) return;
                e.preventDefault();
                // Filter to nodes the caller has permission to delete.
                const ids: string[] = [];
                const allNodes = nodesRef.current;
                for (const id of sel) {
                    const n = allNodes.find((x) => x.id === id);
                    if (n && canEditNode(identity.roomRole, n.acl)) ids.push(id);
                }
                if (ids.length > 0) deleteNodes(yNodes, ids);
                clearSelection();
                return;
            }
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomAtCenter(ZOOM_STEP);
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomAtCenter(1 / ZOOM_STEP);
            } else if (e.key === '0') {
                e.preventDefault();
                setViewport(DEFAULT_VIEWPORT);
            }
        }

        function onKeyUp(e: KeyboardEvent) {
            if (e.code === 'Space') setSpaceHeld(false);
        }

        function zoomAtCenter(factor: number) {
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const v = viewportRef.current;
            const nextZoom = clamp(v.zoom * factor, ZOOM_MIN, ZOOM_MAX);
            const worldX = (cx - v.x) / v.zoom;
            const worldY = (cy - v.y) / v.zoom;
            setViewport({
                x: cx - worldX * nextZoom,
                y: cy - worldY * nextZoom,
                zoom: nextZoom,
            });
        }

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [
        yNodes,
        identity.roomRole,
        clearSelection,
        setCommentOpen,
        setTool,
    ]);

    // ---- Pointer interaction ----
    // Mutually-exclusive pointer-down outcomes:
    //   1. PAN     — middle-mouse, space+left, or empty-canvas-left in select
    //   2. MARQUEE — shift+left on empty canvas in select mode
    //   3. DRAW    — left-down on empty canvas in draw mode
    //   4. PLACE   — left-down on empty canvas in sticky/rect/circle/text mode
    const panRef = useRef<{
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startVx: number;
        startVy: number;
    } | null>(null);

    const drawRef = useRef<{
        pointerId: number;
        strokeId: string;
        rafScheduled: boolean;
        pendingPoint: { x: number; y: number } | null;
    } | null>(null);

    const marqueeRef = useRef<{
        pointerId: number;
    } | null>(null);

    const flushDrawPoint = useCallback(() => {
        const d = drawRef.current;
        if (!d) return;
        d.rafScheduled = false;
        const p = d.pendingPoint;
        if (!p) return;
        appendStrokePoint(yNodes, d.strokeId, p);
        d.pendingPoint = null;
    }, [yNodes]);

    function placeNodeAt(worldX: number, worldY: number, currentTool: Tool) {
        switch (currentTool) {
            case 'sticky':
                createStickyNode(yNodes, {
                    x: worldX - STICKY_DEFAULT_W / 2,
                    y: worldY - STICKY_DEFAULT_H / 2,
                    authorId: identity.authorId,
                });
                break;
            case 'rect':
                createShapeNode(yNodes, {
                    shape: 'rect',
                    x: worldX - SHAPE_DEFAULT_W / 2,
                    y: worldY - SHAPE_DEFAULT_H / 2,
                    authorId: identity.authorId,
                });
                break;
            case 'circle':
                createShapeNode(yNodes, {
                    shape: 'circle',
                    x: worldX - SHAPE_DEFAULT_W / 2,
                    y: worldY - SHAPE_DEFAULT_W / 2, // circle is square
                    authorId: identity.authorId,
                });
                break;
            case 'text':
                createTextBlockNode(yNodes, {
                    x: worldX - TEXT_DEFAULT_W / 2,
                    y: worldY - TEXT_DEFAULT_H / 2,
                    authorId: identity.authorId,
                });
                break;
            default:
                break;
        }
        // After a single placement, return to select so the user can pan
        // / interact with what they just made without dropping a duplicate.
        setTool('select');
    }

    function startPan(e: React.PointerEvent<HTMLDivElement>) {
        const v = viewportRef.current;
        panRef.current = {
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startVx: v.x,
            startVy: v.y,
        };
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    }

    function startMarquee(
        e: React.PointerEvent<HTMLDivElement>,
        screenX: number,
        screenY: number,
    ) {
        marqueeRef.current = { pointerId: e.pointerId };
        setMarquee({
            sx0: screenX,
            sy0: screenY,
            sx1: screenX,
            sy1: screenY,
            additive: e.shiftKey,
        });
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        // Replay mode disables ALL canvas-level edits.
        if (isReplayingRef.current) return;

        // Nodes call stopPropagation, so events that reach here are background.
        const middleButton = e.button === 1;
        const leftWithSpace = e.button === 0 && spaceHeldRef.current;
        const leftButton = e.button === 0;
        const currentTool = toolRef.current;

        // --- Pan paths (always available regardless of tool) ---
        if (middleButton || leftWithSpace) {
            startPan(e);
            return;
        }

        if (!leftButton) return;

        const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { x: worldX, y: worldY } = screenToWorld(sx, sy);

        // Close any open comment popover when clicking blank canvas.
        setCommentOpen(null);

        if (currentTool === 'select') {
            if (e.shiftKey) {
                // Marquee in additive mode.
                startMarquee(e, sx, sy);
                return;
            }
            // Plain empty-canvas click clears selection then pans.
            if (selectionRef.current.size > 0) clearSelection();
            startPan(e);
            return;
        }

        if (currentTool === 'draw') {
            const strokeId = beginStrokeNode(yNodes, {
                x: 0,
                y: 0,
                authorId: identity.authorId,
                color: identity.color,
                initial: { x: worldX, y: worldY },
            });
            drawRef.current = {
                pointerId: e.pointerId,
                strokeId,
                rafScheduled: false,
                pendingPoint: null,
            };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            return;
        }

        // sticky / rect / circle / text → place
        placeNodeAt(worldX, worldY, currentTool);
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        // Always broadcast cursor world position for awareness.
        const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy);
        provider.awareness.setLocalStateField('cursor', world);

        const p = panRef.current;
        if (p && p.pointerId === e.pointerId) {
            setViewport((prev) => ({
                x: p.startVx + (e.clientX - p.startClientX),
                y: p.startVy + (e.clientY - p.startClientY),
                zoom: prev.zoom,
            }));
            return;
        }

        const m = marqueeRef.current;
        if (m && m.pointerId === e.pointerId) {
            setMarquee((prev) =>
                prev ? { ...prev, sx1: sx, sy1: sy } : prev,
            );
            return;
        }

        const d = drawRef.current;
        if (d && d.pointerId === e.pointerId) {
            d.pendingPoint = world;
            if (!d.rafScheduled) {
                d.rafScheduled = true;
                requestAnimationFrame(flushDrawPoint);
            }
        }
    }

    function commitMarquee(rect: MarqueeRect) {
        // Convert screen-space marquee corners to world space using the
        // current viewport (we want the box in world coords so we can
        // intersect with node bboxes which are world coords).
        const w0 = screenToWorld(
            Math.min(rect.sx0, rect.sx1),
            Math.min(rect.sy0, rect.sy1),
        );
        const w1 = screenToWorld(
            Math.max(rect.sx0, rect.sx1),
            Math.max(rect.sy0, rect.sy1),
        );

        const hits: string[] = [];
        for (const n of nodesRef.current) {
            // Each node has a logical bbox at (x,y,w,h). For strokes, use the
            // points' bbox.
            let nx = n.x;
            let ny = n.y;
            let nw = n.w;
            let nh = n.h;
            if (n.type === 'stroke' && n.points.length > 0) {
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;
                for (const p of n.points) {
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                }
                nx = minX;
                ny = minY;
                nw = Math.max(1, maxX - minX);
                nh = Math.max(1, maxY - minY);
            }
            // AABB intersection in world space.
            const overlaps =
                nx < w1.x && nx + nw > w0.x && ny < w1.y && ny + nh > w0.y;
            if (overlaps) hits.push(n.id);
        }

        if (hits.length === 0) {
            if (!rect.additive) clearSelection();
            return;
        }
        if (rect.additive) addToSelection(hits);
        else selectMany(hits);
    }

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
        const p = panRef.current;
        if (p && p.pointerId === e.pointerId) {
            try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            panRef.current = null;
            return;
        }

        const m = marqueeRef.current;
        if (m && m.pointerId === e.pointerId) {
            try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            marqueeRef.current = null;
            const final = marquee;
            setMarquee(null);
            if (final) {
                // Only commit if user actually dragged a non-trivial area.
                const dx = Math.abs(final.sx1 - final.sx0);
                const dy = Math.abs(final.sy1 - final.sy0);
                if (dx > 3 || dy > 3) commitMarquee(final);
                else if (!final.additive) clearSelection();
            }
            return;
        }

        const d = drawRef.current;
        if (d && d.pointerId === e.pointerId) {
            try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            if (d.pendingPoint) {
                appendStrokePoint(yNodes, d.strokeId, d.pendingPoint);
            }
            drawRef.current = null;
        }
    }

    function onPointerLeave() {
        // Clear cursor presence so peers don't see a stale ghost.
        provider.awareness.setLocalStateField('cursor', null);
    }

    // Cursor styling reflects what the next pointer-down will do.
    const cursorClass = isReplaying
        ? 'cursor-default'
        : panRef.current
            ? 'cursor-grabbing'
            : drawRef.current
                ? 'cursor-crosshair'
                : spaceHeld
                    ? 'cursor-grab'
                    : tool === 'select'
                        ? 'cursor-default'
                        : 'cursor-crosshair';

    // Marquee overlay rect in screen coords.
    const marqueeStyle = marquee
        ? {
            left: Math.min(marquee.sx0, marquee.sx1),
            top: Math.min(marquee.sy0, marquee.sy1),
            width: Math.abs(marquee.sx1 - marquee.sx0),
            height: Math.abs(marquee.sy1 - marquee.sy0),
        }
        : null;

    return (
        <div
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            className={cn(
                'relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900',
                cursorClass,
            )}
            style={{
                backgroundImage:
                    'radial-gradient(circle, rgba(0,0,0,0.18) 1px, transparent 1px)',
                backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
                backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                touchAction: 'none',
            }}
        >
            {/* World container — single source of truth for pan/zoom. */}
            <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                    transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
                }}
            >
                {isReplaying ? (
                    <ReplayNodeLayer nodes={visibleNodes} />
                ) : (
                    <CanvasNodeLayer
                        nodes={visibleNodes}
                        yNodes={yNodes}
                        zoom={viewport.zoom}
                        roomRole={identity.roomRole}
                    />
                )}
            </div>

            {/* Marquee overlay (screen space). */}
            {marqueeStyle && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute border border-blue-500 bg-blue-500/10"
                    style={marqueeStyle}
                />
            )}

            {/* Replay mode tint so it's visually obvious editing is paused. */}
            {isReplaying && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-amber-400/10 ring-2 ring-inset ring-amber-500/60"
                />
            )}

            {/* Remote cursors live in screen space so they stay normal-sized. */}
            <CursorLayer presence={presence} viewport={viewport} />

            {/* Floating tool picker. Hidden in replay because tools are inert. */}
            {!isReplaying && <Toolbar />}

            {/* Comment thread popover (screen space, anchored to a node). */}
            {!isReplaying && (
                <CommentPopover
                    yNodes={yNodes}
                    nodes={nodes}
                    viewport={viewport}
                    identity={{
                        authorId: identity.authorId,
                        authorName: identity.authorName,
                        color: identity.color,
                    }}
                    canvasBounds={canvasBounds}
                />
            )}

            {/* Time-Travel Replay timeline. */}
            <TimelineReplay events={eventLog.events} />

            {/* HUD */}
            <div className="pointer-events-none absolute bottom-3 left-3 select-none rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white/90">
                {Math.round(viewport.zoom * 100)}% &middot; ({Math.round(viewport.x)},{' '}
                {Math.round(viewport.y)})
                {selection.size > 0 && (
                    <span className="ml-2 text-amber-300">
                        · {selection.size} selected
                    </span>
                )}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 max-w-xs select-none rounded-md bg-black/60 px-3 py-2 text-xs text-white/80">
                <div className="font-semibold text-white">
                    Canvas · {labelForRole(identity.roomRole)}
                </div>
                <div>1–6 pick a tool · Esc → select / clear</div>
                <div>Shift-drag marquee · Del/Bksp delete</div>
                <div>Space-drag or middle-mouse to pan · ⌘+scroll zoom</div>
                <div>H toggle history · + / − / 0 zoom</div>
            </div>
        </div>
    );
}

function labelForRole(role: RoomRole): string {
    return role === 'lead' ? 'Lead' : role === 'contributor' ? 'Contributor' : 'Viewer';
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}
