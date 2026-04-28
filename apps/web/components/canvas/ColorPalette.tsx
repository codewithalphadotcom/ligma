'use client';

/**
 * ColorPalette — circle-button color picker that appears below the Toolbar.
 *
 * The selected color is stored in `canvas-store.currentColor` and is read by
 * Canvas when creating new strokes / shapes.
 *
 * Visibility:
 *   - Visible when the current tool uses a color (sticky / rect / circle /
 *     text / draw).
 *   - Also visible when the user has any nodes selected, so they can recolor
 *     existing items without switching tools.
 *
 * Behaviour on click:
 *   - Always updates `currentColor` (so subsequent placements use it).
 *   - If a selection exists, also recolors every selected node in one
 *     transaction.
 */

import { Check } from 'lucide-react';
import * as Y from 'yjs';
import { useCanvasUI } from '@/lib/canvas-store';
import { PALETTE_COLORS, type FillMode, type NodeSnapshot } from '@/lib/types';
import { setNodeColorMany, setNodeFillMany } from './node-ops';

/** Tools whose action involves a color choice. */
const COLOR_TOOLS = new Set([
    'sticky',
    'rect',
    'circle',
    'triangle',
    'diamond',
    'hexagon',
    'pentagon',
    'star',
    'parallelogram',
    'line',
    'arrow',
    'text',
    'draw',
]);

/** Tools that produce a shape with a fill mode. */
const SHAPE_TOOLS = new Set([
    'rect',
    'circle',
    'triangle',
    'diamond',
    'hexagon',
    'pentagon',
    'star',
    'parallelogram',
]);

const SHAPE_TYPES: ReadonlySet<NodeSnapshot['type']> = new Set([
    'rect',
    'circle',
    'triangle',
    'diamond',
    'hexagon',
    'pentagon',
    'star',
    'parallelogram',
]);

interface ColorPaletteProps {
    /** The room's nodes Y.Map. Used to recolor selected nodes. */
    yNodes: Y.Map<Y.Map<unknown>>;
}

export function ColorPalette({ yNodes }: ColorPaletteProps) {
    const tool = useCanvasUI((s) => s.tool);
    const currentColor = useCanvasUI((s) => s.currentColor);
    const setCurrentColor = useCanvasUI((s) => s.setCurrentColor);
    const fillMode = useCanvasUI((s) => s.fillMode);
    const setFillMode = useCanvasUI((s) => s.setFillMode);
    const selection = useCanvasUI((s) => s.selection);

    const hasSelection = selection.size > 0;
    const visible = COLOR_TOOLS.has(tool) || hasSelection;
    if (!visible) return null;

    /**
     * Determine whether to show the fill-mode toggle. We show it when the
     * current tool is a shape, OR when at least one selected node is a shape.
     */
    const selectionHasShape = hasSelection && hasShapeInSelection(yNodes, selection);
    const showFillToggle = SHAPE_TOOLS.has(tool) || selectionHasShape;

    function pickColor(color: string) {
        setCurrentColor(color);
        if (hasSelection) {
            setNodeColorMany(yNodes, selection, color);
        }
    }

    function pickFill(mode: FillMode) {
        setFillMode(mode);
        if (selectionHasShape) {
            setNodeFillMany(yNodes, selection, mode);
        }
    }

    return (
        <div
            data-canvas-chrome="color-palette"
            className="pointer-events-auto absolute left-1/2 top-15 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-xl px-2.5 py-2"
            style={{
                background: 'rgba(20,15,10,0.78)',
                border: '1px solid rgba(190,148,96,0.16)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 12px 32px -10px rgba(0,0,0,0.6)',
            }}
        >
            {PALETTE_COLORS.map((color) => {
                const active = currentColor.toLowerCase() === color.toLowerCase();
                return (
                    <button
                        key={color}
                        type="button"
                        aria-label={`Color ${color}`}
                        aria-pressed={active}
                        onClick={() => pickColor(color)}
                        className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                        style={{
                            background: color,
                            boxShadow: active
                                ? '0 0 0 2px rgba(20,15,10,0.95), 0 0 0 4px #ede4d0'
                                : '0 0 0 1px rgba(237,228,208,0.18)',
                        }}
                    >
                        {active && (
                            <Check
                                size={12}
                                strokeWidth={3.5}
                                color={isLight(color) ? '#0b0906' : '#ede4d0'}
                            />
                        )}
                    </button>
                );
            })}
            {showFillToggle && (
                <>
                    <div
                        aria-hidden
                        className="mx-1 h-5 w-px"
                        style={{ background: 'rgba(237,228,208,0.18)' }}
                    />
                    <div
                        role="group"
                        aria-label="Shape fill mode"
                        className="flex items-center gap-0.5 rounded-lg p-0.5"
                        style={{ background: 'rgba(237,228,208,0.06)' }}
                    >
                        {(['solid', 'outline'] as const).map((mode) => {
                            const active = fillMode === mode;
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    aria-pressed={active}
                                    title={mode === 'solid' ? 'Solid fill' : 'Outline only'}
                                    onClick={() => pickFill(mode)}
                                    className="px-2 py-1 text-[11px] font-medium tracking-wide uppercase rounded-md transition-colors"
                                    style={
                                        active
                                            ? { background: '#ede4d0', color: '#0b0906' }
                                            : { background: 'transparent', color: 'rgba(237,228,208,0.72)' }
                                    }
                                >
                                    {mode === 'solid' ? 'Fill' : 'Outline'}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

/** True iff any of the given node ids resolves to a shape-typed node. */
function hasShapeInSelection(
    yNodes: Y.Map<Y.Map<unknown>>,
    selection: ReadonlySet<string>,
): boolean {
    for (const id of selection) {
        const m = yNodes.get(id);
        if (!m) continue;
        const t = m.get('type') as NodeSnapshot['type'] | undefined;
        if (t && SHAPE_TYPES.has(t)) return true;
    }
    return false;
}

/** Quick luminance-ish check so the checkmark contrasts with the swatch. */
function isLight(hex: string): boolean {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return false;
    const v = parseInt(m[1]!, 16);
    const r = (v >> 16) & 0xff;
    const g = (v >> 8) & 0xff;
    const b = v & 0xff;
    return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}
