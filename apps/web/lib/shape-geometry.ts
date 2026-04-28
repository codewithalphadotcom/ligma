/**
 * Pure SVG-points generators for the polygon-based shape kinds. ShapeNode
 * and the drag-preview both consume these so geometry stays consistent
 * between the in-progress preview and the committed node.
 *
 * Pass an `inset` equal to `strokeWidth / 2` so the stroke stays inside
 * the bounding box (matches the rect/circle behaviour used elsewhere).
 */

import type { ShapeKind } from './types';

/**
 * Returns the SVG `points` attribute string for a polygon shape, or `null`
 * for shapes (rect, circle) that use a different SVG primitive.
 */
export function getShapePoints(kind: ShapeKind, W: number, H: number, inset: number): string | null {
    switch (kind) {
        case 'triangle':
            return `${W / 2},${inset} ${W - inset},${H - inset} ${inset},${H - inset}`;

        case 'diamond':
            return `${W / 2},${inset} ${W - inset},${H / 2} ${W / 2},${H - inset} ${inset},${H / 2}`;

        case 'hexagon': {
            // Pointy-top hex: 6 vertices around the bbox.
            const qx = W - inset;
            const qy = H - inset;
            return [
                `${W / 2},${inset}`,
                `${qx},${H * 0.25}`,
                `${qx},${H * 0.75}`,
                `${W / 2},${qy}`,
                `${inset},${H * 0.75}`,
                `${inset},${H * 0.25}`,
            ].join(' ');
        }

        case 'pentagon': {
            // Regular pentagon, point at top, inscribed in the bbox.
            const cx = W / 2;
            const cy = H / 2;
            const rx = W / 2 - inset;
            const ry = H / 2 - inset;
            const pts: string[] = [];
            for (let i = 0; i < 5; i++) {
                const a = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
                pts.push(`${cx + Math.cos(a) * rx},${cy + Math.sin(a) * ry}`);
            }
            return pts.join(' ');
        }

        case 'star': {
            // Classic 5-point star — alternating outer/inner radii at 36°.
            const cx = W / 2;
            const cy = H / 2;
            const Rx = W / 2 - inset;
            const Ry = H / 2 - inset;
            const ratio = 0.382; // golden-ratio inner radius
            const pts: string[] = [];
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + i * (Math.PI / 5);
                const k = i % 2 === 0 ? 1 : ratio;
                pts.push(`${cx + Math.cos(a) * Rx * k},${cy + Math.sin(a) * Ry * k}`);
            }
            return pts.join(' ');
        }

        case 'parallelogram': {
            // Right-leaning parallelogram with a 20% horizontal skew.
            const skew = W * 0.2;
            return [
                `${skew + inset},${inset}`,
                `${W - inset},${inset}`,
                `${W - skew - inset},${H - inset}`,
                `${inset},${H - inset}`,
            ].join(' ');
        }

        default:
            return null;
    }
}

export const POLYGON_SHAPE_KINDS: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
    'triangle',
    'diamond',
    'hexagon',
    'pentagon',
    'star',
    'parallelogram',
]);

export const ALL_SHAPE_KINDS: readonly ShapeKind[] = [
    'rect',
    'circle',
    'triangle',
    'diamond',
    'hexagon',
    'pentagon',
    'star',
    'parallelogram',
];
