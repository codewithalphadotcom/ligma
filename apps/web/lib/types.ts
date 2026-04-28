/**
 * Shared type definitions for canvas nodes and viewport.
 *
 * IMPORTANT: A node's `content` is stored as a Y.Text instance INSIDE the
 * node's Y.Map (key: 'content'). This type describes the plain-JS shape we
 * read out of the Y.Map for rendering — `content` becomes a string snapshot.
 */

export type NodeType =
    | 'sticky'
    | 'rect'
    | 'circle'
    | 'triangle'
    | 'diamond'
    | 'hexagon'
    | 'pentagon'
    | 'star'
    | 'parallelogram'
    | 'line'
    | 'arrow'
    | 'text'
    | 'stroke';

/** Subset of NodeType that is created by the shape tools and rendered by ShapeNode. */
export type ShapeKind =
    | 'rect'
    | 'circle'
    | 'triangle'
    | 'diamond'
    | 'hexagon'
    | 'pentagon'
    | 'star'
    | 'parallelogram'
    | 'line'
    | 'arrow';

export type NodeAcl = 'lead-only' | 'contributor+' | 'all';

/**
 * The current user's role within the room. Defaults to 'lead' for the
 * hackathon (auth/B not wired yet); the full flow will set this from
 * `room_members.role` on the server.
 */
export type RoomRole = 'lead' | 'contributor' | 'viewer';

/** A single comment on a node. Plain JSON — stored as items in a Y.Array. */
export interface NodeComment {
    id: string;
    authorId: string;
    authorName: string;
    color: string;
    text: string;
    createdAt: number;
}

/**
 * Append-only event captured by the client-side event recorder. Used by the
 * Time-Travel Replay UI (A11). When Teammate B's server log is wired up this
 * recorder will be replaced by a server-pushed events stream.
 */
export interface RecordedEvent {
    /** Monotonic per-recorder sequence id (0-based). */
    seq: number;
    /** Wall clock at capture time. */
    ts: number;
    /** Y.js update bytes. */
    update: Uint8Array;
    /** Origin tag of the producing transaction (e.g. 'create-sticky'). */
    origin: string;
}

export type NodeClassification =
    | 'action-item'
    | 'decision'
    | 'open-question'
    | 'reference'
    | null;

/**
 * Direction of a line/arrow node within its bounding box. Encoded as the
 * start corner → end corner so that the arrowhead points in the correct
 * direction the user dragged. For non-line node types this is ignored.
 */
export type LineDir = 'tl-br' | 'tr-bl' | 'bl-tr' | 'br-tl';

/** A 2D point in world space. Used for freehand stroke vertices. */
export interface StrokePoint {
    x: number;
    y: number;
}

/** Plain snapshot of a node Y.Map for React rendering. */
export interface NodeSnapshot {
    id: string;
    type: NodeType;
    x: number;
    y: number;
    w: number;
    h: number;
    /**
     * Plain-string snapshot of the underlying Y.Text (sticky/text nodes).
     * For shape nodes this is the optional label. For strokes this is empty.
     */
    content: string;
    color: string;
    authorId: string;
    acl: NodeAcl;
    classification: NodeClassification;
    taskId: string | null;
    /** Stroke-only: ordered array of world-space points. */
    points: StrokePoint[];
    /** Stroke-only: line width in world pixels. */
    strokeWidth: number;
    /**
     * Sticky / shape / text label font size, in world pixels. Auto-scales
     * during resize so text grows with the box. Default 14.
     */
    fontSize: number;
    /**
     * Visual fill mode for shape nodes. Always 'solid' for non-shape types.
     */
    fill: FillMode;
    /**
     * For line/arrow nodes only: which diagonal of the bounding box the
     * line follows so the arrowhead matches the user's drag direction.
     * Defaults to 'tl-br'.
     */
    lineDir: LineDir;
    /** Number of comments on this node (live count from comments Y.Array). */
    commentCount: number;
    createdAt: number;
    updatedAt: number;
}

export interface Viewport {
    /** Horizontal pan offset in screen pixels. */
    x: number;
    /** Vertical pan offset in screen pixels. */
    y: number;
    /** Zoom factor. 1 = 100%. */
    zoom: number;
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;

export const STICKY_DEFAULT_W = 200;
export const STICKY_DEFAULT_H = 160;

export const SHAPE_DEFAULT_W = 160;
export const SHAPE_DEFAULT_H = 120;

export const TEXT_DEFAULT_W = 240;
export const TEXT_DEFAULT_H = 60;

export const STICKY_COLORS = [
    '#fde68a', // amber-200
    '#fecaca', // red-200
    '#bbf7d0', // green-200
    '#bfdbfe', // blue-200
    '#ddd6fe', // violet-200
    '#fbcfe8', // pink-200
] as const;

/** Tool modes for canvas interaction. */
/** Visual fill mode for shape nodes. `solid` = filled with node.color and a
 *  subtle dark border. `outline` = transparent fill, the chosen color is
 *  applied to the shape's border instead. */
export type FillMode = 'solid' | 'outline';

/** Tool modes for canvas interaction. */
export type Tool =
    | 'select'
    | 'sticky'
    | 'rect'
    | 'circle'
    | 'triangle'
    | 'diamond'
    | 'hexagon'
    | 'pentagon'
    | 'star'
    | 'parallelogram'
    | 'line'
    | 'arrow'
    | 'text'
    | 'draw'
    | 'eraser'
    | 'pixel-eraser';

/** Curated palette used by the toolbar's color picker — tuned to be
 *  legible on the espresso-dark canvas background. */
export const PALETTE_COLORS = [
    '#ede4d0', // ivory (default)
    '#be9460', // brass
    '#f87171', // red
    '#fb923c', // orange
    '#facc15', // amber
    '#4ade80', // green
    '#38bdf8', // sky
    '#a78bfa', // violet
    '#f472b6', // pink
    '#0b0906', // espresso (near-black)
] as const;

export type PaletteColor = typeof PALETTE_COLORS[number];

/**
 * Awareness payload broadcast via Y.js for live presence.
 *
 * `cursor` is in world coordinates so peers can render the cursor at the
 * correct logical location regardless of their own viewport pan/zoom.
 */
export interface UserPresence {
    user: {
        id: string;
        name: string;
        color: string;
    };
    cursor: { x: number; y: number } | null;
}
