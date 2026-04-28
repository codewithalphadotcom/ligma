'use client';

/**
 * Factory + helpers for creating and mutating canvas nodes.
 *
 * Each node is a Y.Map (so individual fields can be updated atomically
 * without touching siblings). The node's `content` is a Y.Text — this is what
 * gives us per-character CRDT merge for sticky / text node text. Strokes use
 * `points: Y.Array<{x,y}>` instead.
 */

import * as Y from 'yjs';
import { nanoid } from 'nanoid';
import {
    SHAPE_DEFAULT_H,
    SHAPE_DEFAULT_W,
    STICKY_COLORS,
    STICKY_DEFAULT_H,
    STICKY_DEFAULT_W,
    TEXT_DEFAULT_H,
    TEXT_DEFAULT_W,
    type FillMode,
    type NodeAcl,
    type NodeComment,
    type NodeType,
    type StrokePoint,
} from '@/lib/types';

interface CreateNodeBase {
    /** World-space x. */
    x: number;
    /** World-space y. */
    y: number;
    authorId: string;
    acl?: NodeAcl;
}

export interface CreateStickyArgs extends CreateNodeBase {
    initialText?: string;
    color?: string;
}

export interface CreateShapeArgs extends CreateNodeBase {
    shape: import('@/lib/types').ShapeKind;
    color?: string;
    /** Optional explicit size (drag-to-create). Defaults to SHAPE_DEFAULT_W/H. */
    w?: number;
    h?: number;
    /** Visual fill mode. Defaults to 'solid'. */
    fill?: FillMode;
    /** Line/arrow only: which diagonal of the bounding box to draw. */
    lineDir?: import('@/lib/types').LineDir;
}

export interface CreateTextBlockArgs extends CreateNodeBase {
    initialText?: string;
    /** Foreground text color (hex). Defaults to ivory so it's visible on the
     *  dark canvas. */
    color?: string;
}

export interface CreateStrokeArgs extends CreateNodeBase {
    /** Stroke colour (hex). */
    color: string;
    /** Initial point. Strokes always start with at least one point. */
    initial: StrokePoint;
    strokeWidth?: number;
}

function pickStickyColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return STICKY_COLORS[Math.abs(hash) % STICKY_COLORS.length]!;
}

function buildBaseMap(args: {
    id: string;
    type: NodeType;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    authorId: string;
    acl: NodeAcl;
    now: number;
}): Y.Map<unknown> {
    const m = new Y.Map<unknown>();
    m.set('id', args.id);
    m.set('type', args.type);
    m.set('x', args.x);
    m.set('y', args.y);
    m.set('w', args.w);
    m.set('h', args.h);
    m.set('color', args.color);
    m.set('authorId', args.authorId);
    m.set('acl', args.acl);
    m.set('classification', null);
    m.set('taskId', null);
    // Comments live as a Y.Array on every node so any participant — including
    // Viewers — can append a comment regardless of edit-lock state (A10).
    m.set('comments', new Y.Array<NodeComment>());
    m.set('createdAt', args.now);
    m.set('updatedAt', args.now);
    // Auto-scaling label font size (sticky / shape / text). Strokes ignore.
    m.set('fontSize', 14);
    // Visual fill mode (shapes only meaningful, default 'solid').
    m.set('fill', 'solid' as FillMode);
    return m;
}

// ─────────────────────────────────────────────────────────── sticky ──

export function createStickyNode(
    nodes: Y.Map<Y.Map<unknown>>,
    args: CreateStickyArgs,
): string {
    const id = nanoid(10);
    const now = Date.now();
    const content = new Y.Text();
    if (args.initialText) content.insert(0, args.initialText);

    nodes.doc!.transact(() => {
        const m = buildBaseMap({
            id,
            type: 'sticky',
            x: args.x,
            y: args.y,
            w: STICKY_DEFAULT_W,
            h: STICKY_DEFAULT_H,
            color: args.color ?? pickStickyColor(args.authorId),
            authorId: args.authorId,
            acl: args.acl ?? 'all',
            now,
        });
        m.set('content', content);
        nodes.set(id, m);
    }, 'create-sticky');

    return id;
}

// ─────────────────────────────────────────────────────────── shape ──

export function createShapeNode(
    nodes: Y.Map<Y.Map<unknown>>,
    args: CreateShapeArgs,
): string {
    const id = nanoid(10);
    const now = Date.now();
    const content = new Y.Text(); // optional shape label

    nodes.doc!.transact(() => {
        const m = buildBaseMap({
            id,
            type: args.shape,
            x: args.x,
            y: args.y,
            w: args.w ?? SHAPE_DEFAULT_W,
            h: args.h ?? (args.shape === 'circle' ? SHAPE_DEFAULT_W : SHAPE_DEFAULT_H),
            color: args.color ?? '#ffffff',
            authorId: args.authorId,
            acl: args.acl ?? 'all',
            now,
        });
        m.set('content', content);
        if (args.fill) m.set('fill', args.fill);
        if (args.lineDir) m.set('lineDir', args.lineDir);
        nodes.set(id, m);
    }, 'create-shape');

    return id;
}

// ────────────────────────────────────────────────────── text block ──

export function createTextBlockNode(
    nodes: Y.Map<Y.Map<unknown>>,
    args: CreateTextBlockArgs,
): string {
    const id = nanoid(10);
    const now = Date.now();
    const content = new Y.Text();
    if (args.initialText) content.insert(0, args.initialText);

    nodes.doc!.transact(() => {
        const m = buildBaseMap({
            id,
            type: 'text',
            x: args.x,
            y: args.y,
            w: TEXT_DEFAULT_W,
            h: TEXT_DEFAULT_H,
            color: args.color ?? '#ede4d0',
            authorId: args.authorId,
            acl: args.acl ?? 'all',
            now,
        });
        m.set('content', content);
        nodes.set(id, m);
    }, 'create-text-block');

    return id;
}

// ────────────────────────────────────────────────────────── stroke ──

/** Begin a freehand stroke. Returns the new stroke node id. */
export function beginStrokeNode(
    nodes: Y.Map<Y.Map<unknown>>,
    args: CreateStrokeArgs,
): string {
    const id = nanoid(10);
    const now = Date.now();
    const points = new Y.Array<StrokePoint>();
    points.push([args.initial]);

    nodes.doc!.transact(() => {
        const m = buildBaseMap({
            id,
            type: 'stroke',
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            color: args.color,
            authorId: args.authorId,
            acl: args.acl ?? 'all',
            now,
        });
        m.set('points', points);
        m.set('strokeWidth', args.strokeWidth ?? 3);
        nodes.set(id, m);
    }, 'begin-stroke');

    return id;
}

/** Append a single point to an in-progress stroke. */
export function appendStrokePoint(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
    pt: StrokePoint,
): void {
    const m = nodes.get(id);
    if (!m) return;
    const arr = m.get('points');
    if (!(arr instanceof Y.Array)) return;
    nodes.doc!.transact(() => {
        arr.push([pt]);
    }, 'append-stroke-point');
}

// ────────────────────────────────────────────────────────── shared ──

/** Update a node's position. Used during drag — high frequency. */
export function setNodePosition(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
    x: number,
    y: number,
): void {
    const m = nodes.get(id);
    if (!m) return;
    nodes.doc!.transact(() => {
        m.set('x', x);
        m.set('y', y);
        m.set('updatedAt', Date.now());
    }, 'move-node');
}

/** Resize a node (and optionally re-anchor its top-left, for handles that
 *  drag the left/top edge). High-frequency during a resize gesture.
 *
 *  When `fontSize` is provided, the node's label font size is updated in the
 *  same transaction so text scales smoothly with the bbox.
 */
export function setNodeSize(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
    rect: { x: number; y: number; w: number; h: number; fontSize?: number },
): void {
    const m = nodes.get(id);
    if (!m) return;
    nodes.doc!.transact(() => {
        m.set('x', rect.x);
        m.set('y', rect.y);
        m.set('w', Math.max(20, rect.w));
        m.set('h', Math.max(20, rect.h));
        if (typeof rect.fontSize === 'number' && Number.isFinite(rect.fontSize)) {
            m.set('fontSize', Math.max(6, Math.min(512, rect.fontSize)));
        }
        m.set('updatedAt', Date.now());
    }, 'resize-node');
}

/** Update a node's fill mode (solid vs outline). Shape-only in practice. */
export function setNodeFill(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
    fill: FillMode,
): void {
    const m = nodes.get(id);
    if (!m) return;
    nodes.doc!.transact(() => {
        m.set('fill', fill);
        m.set('updatedAt', Date.now());
    }, 'set-node-fill');
}

/** Update fill on many nodes in one transaction. */
export function setNodeFillMany(
    nodes: Y.Map<Y.Map<unknown>>,
    ids: Iterable<string>,
    fill: FillMode,
): void {
    const now = Date.now();
    nodes.doc!.transact(() => {
        for (const id of ids) {
            const m = nodes.get(id);
            if (!m) continue;
            const t = m.get('type');
            if (
                t !== 'rect' &&
                t !== 'circle' &&
                t !== 'triangle' &&
                t !== 'diamond' &&
                t !== 'hexagon' &&
                t !== 'pentagon' &&
                t !== 'star' &&
                t !== 'parallelogram'
            )
                continue;
            m.set('fill', fill);
            m.set('updatedAt', now);
        }
    }, 'set-node-fill-many');
}

/** Recolor a node. Stickies use this for the fill, shapes for the fill,
 *  text blocks for the foreground, strokes for the line color. */
export function setNodeColor(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
    color: string,
): void {
    const m = nodes.get(id);
    if (!m) return;
    nodes.doc!.transact(() => {
        m.set('color', color);
        m.set('updatedAt', Date.now());
    }, 'recolor-node');
}

/** Recolor many nodes in one transaction (used by the color palette
 *  when the user has a multi-selection). */
export function setNodeColorMany(
    nodes: Y.Map<Y.Map<unknown>>,
    ids: Iterable<string>,
    color: string,
): void {
    const now = Date.now();
    nodes.doc!.transact(() => {
        for (const id of ids) {
            const m = nodes.get(id);
            if (!m) continue;
            m.set('color', color);
            m.set('updatedAt', now);
        }
    }, 'recolor-nodes');
}

/** Read the live Y.Text for a sticky / text node — used by textarea binding. */
export function getNodeYText(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
): Y.Text | null {
    const m = nodes.get(id);
    if (!m) return null;
    const c = m.get('content');
    return c instanceof Y.Text ? c : null;
}

/** Delete a node by id. */
export function deleteNode(nodes: Y.Map<Y.Map<unknown>>, id: string): void {
    if (!nodes.has(id)) return;
    nodes.doc!.transact(() => {
        nodes.delete(id);
    }, 'delete-node');
}

/** Delete many nodes in a single transaction (so it's one event-log entry). */
export function deleteNodes(
    nodes: Y.Map<Y.Map<unknown>>,
    ids: Iterable<string>,
): void {
    const list = [...ids].filter((id) => nodes.has(id));
    if (list.length === 0) return;
    nodes.doc!.transact(() => {
        for (const id of list) nodes.delete(id);
    }, 'delete-nodes');
}

/**
 * Pixel eraser: remove all stroke vertices that fall within `radius` (world
 * units) of `center`. Strokes that get cut into multiple disjoint segments
 * are split into several stroke nodes (so the visual result matches what
 * the user sees: discontinuous remaining ink). Strokes that lose every
 * point — or whose remaining segments are too tiny to be visible — are
 * deleted.
 *
 * Non-stroke nodes are completely ignored: shapes / sticky notes / text
 * blocks are *only* affected by the object eraser.
 */
export function erasePixelsAt(
    nodes: Y.Map<Y.Map<unknown>>,
    center: { x: number; y: number },
    radius: number,
    authorId: string,
): boolean {
    const r2 = radius * radius;
    const now = Date.now();
    let mutated = false;

    nodes.doc!.transact(() => {
        // Snapshot ids first because we mutate the map during iteration.
        const ids: string[] = [];
        nodes.forEach((_v, k) => ids.push(k));

        for (const id of ids) {
            const m = nodes.get(id);
            if (!m) continue;
            if (m.get('type') !== 'stroke') continue;
            const arr = m.get('points');
            if (!(arr instanceof Y.Array)) continue;

            const pts = arr.toArray() as StrokePoint[];
            if (pts.length === 0) continue;

            // Mark each point as kept/erased. Then split into runs of kept.
            const kept: boolean[] = pts.map((p) => {
                const dx = p.x - center.x;
                const dy = p.y - center.y;
                return dx * dx + dy * dy > r2;
            });

            // Fast-path: nothing in radius — skip.
            if (kept.every(Boolean)) continue;
            mutated = true;

            // Collect contiguous kept runs.
            const segments: StrokePoint[][] = [];
            let cur: StrokePoint[] = [];
            for (let i = 0; i < pts.length; i++) {
                if (kept[i]) {
                    cur.push(pts[i]!);
                } else if (cur.length > 0) {
                    segments.push(cur);
                    cur = [];
                }
            }
            if (cur.length > 0) segments.push(cur);

            // Drop segments too short to render meaningfully (single point
            // looks like a dot but feels like a glitch in the eraser flow).
            const meaningful = segments.filter((s) => s.length >= 2);

            // Carry stroke metadata for any new segment nodes.
            const color = (m.get('color') as string) ?? '#ede4d0';
            const strokeWidth = (m.get('strokeWidth') as number) ?? 3;
            const acl = (m.get('acl') as NodeAcl) ?? 'all';

            if (meaningful.length === 0) {
                nodes.delete(id);
                continue;
            }

            // Reuse the original node for the first remaining segment.
            const first = meaningful[0]!;
            const newPoints = new Y.Array<StrokePoint>();
            newPoints.push(first);
            m.set('points', newPoints);
            m.set('updatedAt', now);

            // Spawn fresh nodes for any additional segments so the gap is
            // honoured in the rendered polyline.
            for (let i = 1; i < meaningful.length; i++) {
                const segPoints = new Y.Array<StrokePoint>();
                segPoints.push(meaningful[i]!);
                const newId = nanoid(10);
                const newMap = buildBaseMap({
                    id: newId,
                    type: 'stroke',
                    x: 0,
                    y: 0,
                    w: 0,
                    h: 0,
                    color,
                    authorId,
                    acl,
                    now,
                });
                newMap.set('points', segPoints);
                newMap.set('strokeWidth', strokeWidth);
                nodes.set(newId, newMap);
            }
        }
    }, 'erase-pixels');

    return mutated;
}

/** Update the ACL on a node (Lead-only operation in the UI; A9). */
export function setNodeAcl(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
    acl: NodeAcl,
): void {
    const m = nodes.get(id);
    if (!m) return;
    nodes.doc!.transact(() => {
        m.set('acl', acl);
        m.set('updatedAt', Date.now());
    }, 'set-node-acl');
}

/**
 * Read the live comments Y.Array for a node. Lazily initialises one if the
 * node was created before the comments field was added (forward-compat).
 */
export function getCommentsArray(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
): Y.Array<NodeComment> | null {
    const m = nodes.get(id);
    if (!m) return null;
    let arr = m.get('comments');
    if (!(arr instanceof Y.Array)) {
        const fresh = new Y.Array<NodeComment>();
        nodes.doc!.transact(() => {
            m.set('comments', fresh);
        }, 'init-comments');
        arr = fresh;
    }
    return arr as Y.Array<NodeComment>;
}

/** Append a comment to a node's comments array (A10). */
export function addComment(
    nodes: Y.Map<Y.Map<unknown>>,
    id: string,
    comment: Omit<NodeComment, 'id' | 'createdAt'>,
): void {
    const arr = getCommentsArray(nodes, id);
    if (!arr) return;
    const full: NodeComment = {
        id: nanoid(8),
        createdAt: Date.now(),
        ...comment,
    };
    nodes.doc!.transact(() => {
        arr.push([full]);
    }, 'add-comment');
}
