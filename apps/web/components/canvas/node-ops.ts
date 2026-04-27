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
    shape: 'rect' | 'circle';
    color?: string;
}

export interface CreateTextBlockArgs extends CreateNodeBase {
    initialText?: string;
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
            w: SHAPE_DEFAULT_W,
            h: args.shape === 'circle' ? SHAPE_DEFAULT_W : SHAPE_DEFAULT_H,
            color: args.color ?? '#ffffff',
            authorId: args.authorId,
            acl: args.acl ?? 'all',
            now,
        });
        m.set('content', content);
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
            color: 'transparent',
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
