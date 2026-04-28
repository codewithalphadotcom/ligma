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
import { getShapePoints } from '@/lib/shape-geometry';
import { useCanvasUI } from '@/lib/canvas-store';
import {
    appendStrokePoint,
    beginStrokeNode,
    createShapeNode,
    createStickyNode,
    createTextBlockNode,
    deleteNode,
    deleteNodes,
    erasePixelsAt,
} from './node-ops';
import { canEditNode } from '@/lib/acl';
import { CanvasNodeLayer } from './CanvasNodeLayer';
import { ReplayNodeLayer } from './ReplayNodeLayer';
import { Toolbar } from './Toolbar';
import { ColorPalette } from './ColorPalette';
import { CursorLayer } from './CursorLayer';
import { ShareButton } from './ShareButton';
import { PrivateRoomsButton } from './PrivateRoomsButton';
import { MembersSidebar } from './MembersSidebar';
import { ZoomDock } from './ZoomDock';
import { ClassificationLegend } from './ClassificationLegend';
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
    roomId: string;
    yNodes: Y.Map<Y.Map<unknown>>;
    nodes: NodeSnapshot[];
    identity: Identity;
    provider: WebsocketProvider;
    /** Room-level metadata Y.Map (used to broadcast role-change pings). */
    meta: Y.Map<unknown>;
}

const ZOOM_STEP = 1.1;
const ZOOM_WHEEL_SENSITIVITY = 0.0015;
const PAN_WHEEL_SENSITIVITY = 1;

/** Screen-space radius of the pixel-eraser's effect zone. World-space
 *  radius is derived by dividing by the current zoom so the eraser feels
 *  like a constant-size brush regardless of zoom level. */
const PIXEL_ERASER_RADIUS_SCREEN = 14;

interface MarqueeRect {
    /** All four in screen-space client coords. */
    sx0: number;
    sy0: number;
    sx1: number;
    sy1: number;
    /** True if shift was held at start (additive selection). */
    additive: boolean;
}

export function Canvas({ roomId, yNodes, nodes, identity, provider, meta }: CanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
    const [canvasBounds, setCanvasBounds] = useState<DOMRect | null>(null);

    const tool = useCanvasUI((s) => s.tool);
    const setTool = useCanvasUI((s) => s.setTool);
    const currentColor = useCanvasUI((s) => s.currentColor);
    const fillMode = useCanvasUI((s) => s.fillMode);
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
    const currentColorRef = useRef(currentColor);
    currentColorRef.current = currentColor;
    const fillModeRef = useRef(fillMode);
    fillModeRef.current = fillMode;
    const isReplayingRef = useRef(isReplaying);
    isReplayingRef.current = isReplaying;
    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    const selectionRef = useRef(selection);
    selectionRef.current = selection;

    const presence = useAwareness(provider);

    // ---- Y.UndoManager bound to the room's nodes map ----
    // We tag every local transaction with a string origin (see node-ops.ts);
    // by default UndoManager only tracks transactions with `null` origin, so
    // none of our edits would be undoable. Pass an explicit `trackedOrigins`
    // set listing every local origin we want on the undo stack.
    //
    // Stroke point appends are intentionally NOT tracked individually —
    // captureTimeout batches the parent stroke into a single step, and we
    // skip the noisy per-point origin so undo collapses a stroke as one
    // unit. The initial `begin-stroke` IS tracked (so undo on a finished
    // stroke removes it).
    const [undoManager, setUndoManager] = useState<Y.UndoManager | null>(null);
    useEffect(() => {
        const um = new Y.UndoManager(yNodes, {
            captureTimeout: 400,
            trackedOrigins: new Set<string | null>([
                null,
                'create-sticky',
                'create-shape',
                'create-text-block',
                'begin-stroke',
                'append-stroke-point',
                'move-node',
                'resize-node',
                'recolor-node',
                'recolor-nodes',
                'delete-node',
                'delete-nodes',
                'set-node-acl',
            ]),
        });
        setUndoManager(um);
        return () => {
            um.destroy();
            setUndoManager(null);
        };
    }, [yNodes]);

    // ---- Zoom helpers (also wired to ZoomDock) ----
    const zoomBy = useCallback((factor: number) => {
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
    }, []);
    const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
    const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);
    const resetZoom = useCallback(() => setViewport(DEFAULT_VIEWPORT), []);

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

    // ---- Jump-to-node (C7): centre the viewport on a node by id ----
    // Triggered by `window.dispatchEvent(new CustomEvent('ligma:jump-to-node',
    // { detail: { nodeId } }))` — currently fired by the TaskBoard "Jump"
    // button. We translate the node's world-space bounds into the screen
    // coords needed to centre it inside the canvas container, preserving the
    // current zoom level. The node is also added to the selection so the
    // user immediately sees what was targeted.
    useEffect(() => {
        function onJump(ev: Event) {
            const detail = (ev as CustomEvent<{ nodeId?: string }>).detail;
            const nodeId = detail?.nodeId;
            if (!nodeId) return;
            const target = nodesRef.current.find((n) => n.id === nodeId);
            const el = containerRef.current;
            if (!target || !el) return;

            const rect = el.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const v = viewportRef.current;
            const targetWorldX = target.x + target.w / 2;
            const targetWorldY = target.y + target.h / 2;
            setViewport({
                x: cx - targetWorldX * v.zoom,
                y: cy - targetWorldY * v.zoom,
                zoom: v.zoom,
            });
            selectOnly(nodeId);
        }
        window.addEventListener('ligma:jump-to-node', onJump);
        return () => window.removeEventListener('ligma:jump-to-node', onJump);
    }, [selectOnly]);

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
            // Cmd/Ctrl+A — select every node on the canvas. Lets the user
            // grab the whole clutter and follow up with Delete.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
                if (isReplayingRef.current) return;
                e.preventDefault();
                const ids = nodesRef.current.map((n) => n.id);
                if (ids.length > 0) selectMany(ids);
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
                zoomIn();
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                resetZoom();
            }
        }

        function onKeyUp(e: KeyboardEvent) {
            if (e.code === 'Space') setSpaceHeld(false);
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
        selectMany,
        setCommentOpen,
        setTool,
        zoomIn,
        zoomOut,
        resetZoom,
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
        lastPoint: { x: number; y: number } | null;
    } | null>(null);

    /** Active shape drag-to-create gesture. */
    const shapeDraftRef = useRef<{
        pointerId: number;
        kind: import('@/lib/types').ShapeKind;
        startWorldX: number;
        startWorldY: number;
    } | null>(null);
    /** Live preview rect in WORLD coordinates (rendered inside the
     *  pan/zoom transform so it lines up perfectly with the final shape). */
    const [shapeDraft, setShapeDraft] = useState<{
        kind: import('@/lib/types').ShapeKind;
        x: number;
        y: number;
        w: number;
        h: number;
        color: string;
        lineDir: import('@/lib/types').LineDir;
    } | null>(null);

    const marqueeRef = useRef<{
        pointerId: number;
    } | null>(null);

    /** Active pixel-eraser drag. */
    const pixelEraseRef = useRef<{ pointerId: number } | null>(null);

    /** Live screen-space cursor position for the pixel-eraser preview ring. */
    const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null);

    function placeNodeAt(worldX: number, worldY: number, currentTool: Tool) {
        switch (currentTool) {
            case 'sticky':
                createStickyNode(yNodes, {
                    x: worldX - STICKY_DEFAULT_W / 2,
                    y: worldY - STICKY_DEFAULT_H / 2,
                    authorId: identity.authorId,
                    color: currentColorRef.current,
                });
                break;
            case 'text':
                createTextBlockNode(yNodes, {
                    x: worldX - TEXT_DEFAULT_W / 2,
                    y: worldY - TEXT_DEFAULT_H / 2,
                    authorId: identity.authorId,
                    color: currentColorRef.current,
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

        // Ignore pointerdown events that originate from floating chrome
        // (toolbar, zoom dock, share button, modals). Without this guard the
        // canvas would call setPointerCapture and steal the corresponding
        // pointerup from the button, so clicks would never fire.
        // NB: lucide-react icons render <svg>, which is an SVGElement (NOT
        // HTMLElement). Use Element so SVG/HTML targets both qualify.
        if (
            e.target instanceof Element &&
            e.target.closest('[data-canvas-chrome]')
        ) {
            return;
        }

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
            // Plain empty-canvas drag in Select mode = marquee selection.
            // This matches Figma / Excalidraw / tldraw expectations and lets
            // the user lasso piles of clutter quickly. Pan is still available
            // via Space-drag and middle-mouse (handled above).
            if (selectionRef.current.size > 0 && !e.shiftKey) clearSelection();
            startMarquee(e, sx, sy);
            return;
        }

        if (currentTool === 'eraser') {
            // Empty-canvas click in eraser mode = no-op (nodes are deleted in
            // the capture-phase handler before the click reaches here).
            return;
        }

        if (currentTool === 'pixel-eraser') {
            // The capture-phase handler already started the sweep — nothing
            // more to do on the canvas-level pointerdown.
            return;
        }

        if (currentTool === 'draw') {
            const strokeId = beginStrokeNode(yNodes, {
                x: 0,
                y: 0,
                authorId: identity.authorId,
                color: currentColorRef.current,
                initial: { x: worldX, y: worldY },
            });
            drawRef.current = {
                pointerId: e.pointerId,
                strokeId,
                lastPoint: { x: worldX, y: worldY },
            };
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            return;
        }

        if (
            currentTool === 'rect' ||
            currentTool === 'circle' ||
            currentTool === 'triangle' ||
            currentTool === 'diamond' ||
            currentTool === 'hexagon' ||
            currentTool === 'pentagon' ||
            currentTool === 'star' ||
            currentTool === 'parallelogram' ||
            currentTool === 'line' ||
            currentTool === 'arrow'
        ) {
            shapeDraftRef.current = {
                pointerId: e.pointerId,
                kind: currentTool,
                startWorldX: worldX,
                startWorldY: worldY,
            };
            setShapeDraft({
                kind: currentTool,
                x: worldX,
                y: worldY,
                w: 0,
                h: 0,
                color: currentColorRef.current,
                lineDir: 'tl-br',
            });
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            return;
        }

        // sticky / text → place at click point
        placeNodeAt(worldX, worldY, currentTool);
    }

    /**
     * Capture-phase listener: nodes call stopPropagation in their bubble-phase
     * handlers, but capture fires on the way down so we still see them. When
     * the eraser tool is active, a click on any node deletes that node.
     */
    function onPointerDownCapture(e: React.PointerEvent<HTMLDivElement>) {
        if (isReplayingRef.current) return;
        if (e.button !== 0) return;
        const t = toolRef.current;
        if (t !== 'eraser' && t !== 'pixel-eraser') return;
        if (!(e.target instanceof HTMLElement || e.target instanceof SVGElement)) return;
        // Don't erase chrome (toolbar etc.)
        if (e.target.closest('[data-canvas-chrome]')) return;

        if (t === 'pixel-eraser') {
            // Start the pixel-erase sweep here in the capture phase so it
            // works even when the down event lands on a stroke's SVG path
            // (whose bubble-phase handler would otherwise call stopPropagation
            // and prevent the canvas-level onPointerDown from running).
            e.preventDefault();
            e.stopPropagation();
            const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const world = screenToWorld(sx, sy);
            pixelEraseRef.current = { pointerId: e.pointerId };
            erasePixelsAt(
                yNodes,
                world,
                PIXEL_ERASER_RADIUS_SCREEN / viewportRef.current.zoom,
                identity.authorId,
            );
            try {
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            return;
        }

        // Object eraser: deletes whichever node the click landed on.
        const nodeEl = e.target.closest('[data-node-id]');
        const nodeId = nodeEl?.getAttribute('data-node-id');
        if (!nodeId) return;
        e.preventDefault();
        e.stopPropagation();
        deleteNode(yNodes, nodeId);
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        // Always broadcast cursor world position for awareness.
        const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy);
        provider.awareness.setLocalStateField('cursor', world);

        // Update the eraser preview ring (only renders for pixel-eraser tool).
        if (toolRef.current === 'pixel-eraser') {
            setEraserCursor({ x: sx, y: sy });
        } else if (eraserCursor !== null) {
            setEraserCursor(null);
        }

        const pe = pixelEraseRef.current;
        if (pe && pe.pointerId === e.pointerId) {
            erasePixelsAt(
                yNodes,
                world,
                PIXEL_ERASER_RADIUS_SCREEN / viewportRef.current.zoom,
                identity.authorId,
            );
            return;
        }

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
            // Skip near-duplicate points to avoid Yjs spam at high event rates.
            const last = d.lastPoint;
            if (
                !last ||
                Math.abs(world.x - last.x) > 0.5 ||
                Math.abs(world.y - last.y) > 0.5
            ) {
                appendStrokePoint(yNodes, d.strokeId, world);
                d.lastPoint = world;
            }
            return;
        }

        const sd = shapeDraftRef.current;
        if (sd && sd.pointerId === e.pointerId) {
            const dx = world.x - sd.startWorldX;
            const dy = world.y - sd.startWorldY;
            const minX = Math.min(sd.startWorldX, world.x);
            const minY = Math.min(sd.startWorldY, world.y);
            let w = Math.abs(dx);
            let h = Math.abs(dy);
            // Circles are constrained to a square so the bbox is unambiguous.
            if (sd.kind === 'circle') {
                const s = Math.max(w, h);
                w = s;
                h = s;
            }
            // For line / arrow, encode the actual drag direction so the
            // committed node renders the diagonal that matches the user's
            // cursor (start point stays fixed, end point follows mouse).
            let lineDir: import('@/lib/types').LineDir = 'tl-br';
            if (sd.kind === 'line' || sd.kind === 'arrow') {
                if (dx >= 0 && dy >= 0) lineDir = 'tl-br';
                else if (dx >= 0 && dy < 0) lineDir = 'bl-tr';
                else if (dx < 0 && dy >= 0) lineDir = 'tr-bl';
                else lineDir = 'br-tl';
            }
            setShapeDraft({
                kind: sd.kind,
                x: minX,
                y: minY,
                w,
                h,
                color: currentColorRef.current,
                lineDir,
            });
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
        const pe = pixelEraseRef.current;
        if (pe && pe.pointerId === e.pointerId) {
            try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            pixelEraseRef.current = null;
            return;
        }

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
            drawRef.current = null;
            return;
        }

        const sd = shapeDraftRef.current;
        if (sd && sd.pointerId === e.pointerId) {
            try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            shapeDraftRef.current = null;

            const draft = shapeDraft;
            setShapeDraft(null);

            // Commit only if the user actually dragged a meaningful area;
            // otherwise treat it as a click and place a default-sized shape.
            const minDrag = 6;
            const isLineKind = sd.kind === 'line' || sd.kind === 'arrow';

            if (isLineKind) {
                // For lines, commit if EITHER dimension exceeds minDrag — a
                // perfectly horizontal or vertical line has h=0 or w=0 but is
                // still a valid line. Pad the small axis to at least 2px so
                // the bounding box is not degenerate.
                const dragged =
                    draft && (draft.w > minDrag || draft.h > minDrag);
                let w: number;
                let h: number;
                let x: number;
                let y: number;
                if (dragged && draft) {
                    w = Math.max(draft.w, 2);
                    h = Math.max(draft.h, 2);
                    x = draft.x;
                    y = draft.y;
                } else {
                    // Click-to-place: default 120px horizontal line.
                    w = 120;
                    h = 2;
                    x = sd.startWorldX - w / 2;
                    y = sd.startWorldY - h / 2;
                }
                createShapeNode(yNodes, {
                    shape: sd.kind,
                    x,
                    y,
                    w,
                    h,
                    authorId: identity.authorId,
                    color: currentColorRef.current,
                    fill: fillModeRef.current,
                    lineDir: draft?.lineDir ?? 'tl-br',
                });
                setTool('select');
                return;
            }

            const w = draft && draft.w > minDrag ? draft.w : SHAPE_DEFAULT_W;
            const h = draft && draft.h > minDrag
                ? draft.h
                : sd.kind === 'circle'
                    ? SHAPE_DEFAULT_W
                    : SHAPE_DEFAULT_H;
            const x = draft && draft.w > minDrag
                ? draft.x
                : sd.startWorldX - w / 2;
            const y = draft && draft.h > minDrag
                ? draft.y
                : sd.startWorldY - h / 2;

            createShapeNode(yNodes, {
                shape: sd.kind,
                x,
                y,
                w,
                h,
                authorId: identity.authorId,
                color: currentColorRef.current,
                fill: fillModeRef.current,
            });
            setTool('select');
        }
    }

    function onPointerLeave() {
        // Clear cursor presence so peers don't see a stale ghost.
        provider.awareness.setLocalStateField('cursor', null);
        if (eraserCursor !== null) setEraserCursor(null);
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
                    : tool === 'pixel-eraser'
                        ? 'cursor-none'
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
            onPointerDownCapture={onPointerDownCapture}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            className={cn(
                'relative h-full w-full overflow-hidden',
                cursorClass,
            )}
            style={{
                background: '#0b0906',
                backgroundImage:
                    'radial-gradient(circle, rgba(190,148,96,0.14) 1px, transparent 1px)',
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

                {/* Live preview while drag-creating a shape. Lives inside the
                 *  world container so it transforms with pan/zoom. */}
                {shapeDraft && (
                    <ShapeDraftPreview draft={shapeDraft} fillMode={fillMode} />
                )}
            </div>

            {/* Marquee overlay (screen space). */}
            {marqueeStyle && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute border bg-[rgba(190,148,96,0.10)]"
                    style={{ ...marqueeStyle, borderColor: 'rgba(190,148,96,0.55)' }}
                />
            )}

            {/* Pixel-eraser preview ring (screen space). */}
            {tool === 'pixel-eraser' && eraserCursor && !isReplaying && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute rounded-full"
                    style={{
                        left: eraserCursor.x - PIXEL_ERASER_RADIUS_SCREEN,
                        top: eraserCursor.y - PIXEL_ERASER_RADIUS_SCREEN,
                        width: PIXEL_ERASER_RADIUS_SCREEN * 2,
                        height: PIXEL_ERASER_RADIUS_SCREEN * 2,
                        border: '1.5px solid rgba(237,228,208,0.85)',
                        background: 'rgba(237,228,208,0.08)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                    }}
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

            {/* Top-center: minimalist tool picker. Hidden while replaying
                or for view-only members (viewers can't create nodes anyway,
                so showing them the toolbar would just be misleading). */}
            {!isReplaying && identity.roomRole !== 'viewer' && <Toolbar />}

            {/* Below toolbar: color picker. Same viewer/replay rules. */}
            {!isReplaying && identity.roomRole !== 'viewer' && <ColorPalette yNodes={yNodes} />}

            {/* Top-right: private-rooms shortcut + copy-link share button. */}
            {!isReplaying && (
                <div
                    data-canvas-chrome="top-right-cluster"
                    className="pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-2"
                >
                    <PrivateRoomsButton />
                    <ShareButton />
                </div>
            )}

            {/* Top-left: members sidebar toggle. */}
            {!isReplaying && (
                <MembersSidebar
                    roomId={roomId}
                    selfId={identity.authorId}
                    selfName={identity.authorName}
                    selfColor={identity.color}
                    presence={presence}
                    meta={meta}
                />
            )}

            {/* Bottom-left: zoom controls + undo/redo. */}
            {!isReplaying && (
                <ZoomDock
                    zoom={viewport.zoom}
                    onZoomIn={zoomIn}
                    onZoomOut={zoomOut}
                    onResetZoom={resetZoom}
                    undoManager={undoManager}
                />
            )}

            {/* Bottom-right: AI classification legend. Always available
                (including for viewers) so they understand the colored pills
                that appear above auto-classified notes. */}
            {!isReplaying && <ClassificationLegend />}
        </div>
    );
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}

/**
 * Renders a translucent preview of the in-progress drag-to-create shape.
 * Mirrors the geometry that ShapeNode will use after commit, so the user
 * gets WYSIWYG feedback for triangles and diamonds (not just bbox dashes).
 */
function ShapeDraftPreview({
    draft,
    fillMode,
}: {
    draft: {
        kind: import('@/lib/types').ShapeKind;
        x: number;
        y: number;
        w: number;
        h: number;
        color: string;
        lineDir: import('@/lib/types').LineDir;
    };
    fillMode: 'solid' | 'outline';
}) {
    const W = Math.max(1, draft.w);
    const H = Math.max(1, draft.h);
    const isOutline = fillMode === 'outline';
    const fill = isOutline ? 'transparent' : draft.color;
    const stroke = isOutline ? draft.color : 'rgba(190,148,96,0.85)';
    const sw = isOutline ? 2 : 2;
    const inset = sw / 2;

    let geo: React.ReactNode = null;
    switch (draft.kind) {
        case 'circle':
            geo = (
                <ellipse
                    cx={W / 2}
                    cy={H / 2}
                    rx={Math.max(0, W / 2 - inset)}
                    ry={Math.max(0, H / 2 - inset)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeDasharray="6 4"
                />
            );
            break;
        case 'rect':
            geo = (
                <rect
                    x={inset}
                    y={inset}
                    width={Math.max(0, W - sw)}
                    height={Math.max(0, H - sw)}
                    rx={6}
                    ry={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeDasharray="6 4"
                />
            );
            break;
        default: {
            const pts = getShapePoints(draft.kind, W, H, inset);
            if (pts) {
                geo = (
                    <polygon
                        points={pts}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={sw}
                        strokeDasharray="6 4"
                        strokeLinejoin="round"
                    />
                );
            } else if (draft.kind === 'line' || draft.kind === 'arrow') {
                // Map lineDir to start/end corners of the bbox so the live
                // preview follows the user's cursor (start point fixed, end
                // point chases the mouse).
                const corners: Record<
                    import('@/lib/types').LineDir,
                    [number, number, number, number]
                > = {
                    'tl-br': [inset, inset, Math.max(inset, W - inset), Math.max(inset, H - inset)],
                    'tr-bl': [Math.max(inset, W - inset), inset, inset, Math.max(inset, H - inset)],
                    'bl-tr': [inset, Math.max(inset, H - inset), Math.max(inset, W - inset), inset],
                    'br-tl': [Math.max(inset, W - inset), Math.max(inset, H - inset), inset, inset],
                };
                const [x1, y1, x2, y2] = corners[draft.lineDir];
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
                geo = (
                    <g>
                        <line
                            x1={x1}
                            y1={y1}
                            x2={draft.kind === 'arrow' ? baseX : x2}
                            y2={draft.kind === 'arrow' ? baseY : y2}
                            stroke={draft.color}
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            strokeLinecap="round"
                        />
                        {draft.kind === 'arrow' && (
                            <polygon
                                points={`${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`}
                                fill={draft.color}
                                stroke={draft.color}
                                strokeWidth={2}
                                strokeLinejoin="round"
                            />
                        )}
                    </g>
                );
            }
            break;
        }
    }

    return (
        <svg
            aria-hidden
            className="pointer-events-none absolute"
            style={{
                left: draft.x,
                top: draft.y,
                width: draft.w,
                height: draft.h,
                opacity: 0.7,
                overflow: 'visible',
            }}
            width={draft.w}
            height={draft.h}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
        >
            {geo}
        </svg>
    );
}
