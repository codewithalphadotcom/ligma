'use client';

/**
 * Toolbar — floating top-centre tool picker for the canvas.
 *
 * Tools determine what a left-click on the empty canvas does:
 *   select        — pan / marquee
 *   sticky        — place a sticky note at the click point
 *   rect / circle / triangle / diamond / hexagon / pentagon / star /
 *     parallelogram — drag to draw the corresponding shape
 *   text          — place a text block
 *   draw          — freehand drawing
 *   eraser        — single button. Activates object eraser by default.
 *                   When active, a sub-row appears below the toolbar
 *                   offering OBJECT / PIXEL (matches the FILL / OUTLINE
 *                   pattern used by ColorPalette).
 *
 * Hotkeys
 *   1 select  2 sticky  3 rect  4 circle  5 triangle  6 diamond
 *   7 hexagon 8 pentagon 9 star  0 parallelogram
 *   T text    D draw    E object-eraser   Shift+E pixel-eraser
 *   Esc returns to select.
 *
 * Tooltips fade + slide in on hover (~180 ms) and out on leave for the
 * polished feel users expect from premium design tools.
 */

import { useEffect, useState } from 'react';
import {
    MousePointer2,
    StickyNote as StickyNoteIcon,
    Square,
    Circle,
    Triangle,
    Diamond,
    Hexagon,
    Star,
    Type,
    Pencil,
    Eraser,
    Minus,
    MoveUpRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useCanvasUI } from '@/lib/canvas-store';
import type { Tool } from '@/lib/types';

type IconProps = { size?: number };

/** Lucide doesn't ship a Pentagon icon, so we draw one that matches the
 *  visual weight of the rest of the line icons. */
function PentagonIcon({ size = 17 }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <polygon points="12,3 21.5,9.85 17.85,21 6.15,21 2.5,9.85" />
        </svg>
    );
}

/** Inline parallelogram icon. */
function ParallelogramIcon({ size = 17 }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <polygon points="7,5 21,5 17,19 3,19" />
        </svg>
    );
}

interface ToolDef {
    id: Tool;
    label: string;
    hotkey: string;
    Icon: React.ComponentType<IconProps>;
}

/** Top-level entries. The eraser is rendered here too — its sub-options
 *  (object / pixel) live in a separate row below the toolbar. */
const TOOLS: ToolDef[] = [
    { id: 'select', label: 'Select / pan', hotkey: '1', Icon: MousePointer2 },
    { id: 'sticky', label: 'Sticky note', hotkey: '2', Icon: StickyNoteIcon },
    { id: 'rect', label: 'Rectangle', hotkey: '3', Icon: Square },
    { id: 'circle', label: 'Circle', hotkey: '4', Icon: Circle },
    { id: 'triangle', label: 'Triangle', hotkey: '5', Icon: Triangle },
    { id: 'diamond', label: 'Diamond', hotkey: '6', Icon: Diamond },
    { id: 'hexagon', label: 'Hexagon', hotkey: '7', Icon: Hexagon },
    { id: 'pentagon', label: 'Pentagon', hotkey: '8', Icon: PentagonIcon },
    { id: 'star', label: 'Star', hotkey: '9', Icon: Star },
    { id: 'parallelogram', label: 'Parallelogram', hotkey: '0', Icon: ParallelogramIcon },
    { id: 'line', label: 'Line', hotkey: 'L', Icon: Minus },
    { id: 'arrow', label: 'Arrow', hotkey: 'A', Icon: MoveUpRight },
    { id: 'text', label: 'Text', hotkey: 'T', Icon: Type },
    { id: 'draw', label: 'Draw', hotkey: 'D', Icon: Pencil },
];

const HOTKEY_TO_TOOL: Record<string, Tool> = {
    '1': 'select',
    '2': 'sticky',
    '3': 'rect',
    '4': 'circle',
    '5': 'triangle',
    '6': 'diamond',
    '7': 'hexagon',
    '8': 'pentagon',
    '9': 'star',
    '0': 'parallelogram',
};

export function Toolbar() {
    const tool = useCanvasUI((s) => s.tool);
    const setTool = useCanvasUI((s) => s.setTool);

    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const eraserActive = tool === 'eraser' || tool === 'pixel-eraser';

    useEffect(() => {
        function isTyping(target: EventTarget | null): boolean {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
        }

        function onKeyDown(e: KeyboardEvent) {
            if (isTyping(e.target)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            if (e.key === 'Escape') {
                setTool('select');
                return;
            }

            // Letter hotkeys (case-insensitive). Shift+E activates the
            // pixel eraser; plain E activates the object eraser.
            const k = e.key.toLowerCase();
            if (k === 't') {
                e.preventDefault();
                setTool('text');
                return;
            }
            if (k === 'l') {
                e.preventDefault();
                setTool('line');
                return;
            }
            if (k === 'a') {
                e.preventDefault();
                setTool('arrow');
                return;
            }
            if (k === 'd') {
                e.preventDefault();
                setTool('draw');
                return;
            }
            if (k === 'e') {
                e.preventDefault();
                setTool(e.shiftKey ? 'pixel-eraser' : 'eraser');
                return;
            }

            const mapped = HOTKEY_TO_TOOL[e.key];
            if (mapped) {
                e.preventDefault();
                setTool(mapped);
            }
        }

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [setTool]);

    return (
        <>
            <div
                data-canvas-chrome="toolbar"
                className="pointer-events-auto absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-xl p-1"
                style={{
                    background: 'rgba(20,15,10,0.78)',
                    border: '1px solid rgba(190,148,96,0.16)',
                    backdropFilter: 'blur(18px)',
                    boxShadow: '0 12px 32px -10px rgba(0,0,0,0.6)',
                }}
            >
                {TOOLS.map(({ id, label, hotkey, Icon }) => {
                    const active = tool === id;
                    return (
                        <ToolButton
                            key={id}
                            active={active}
                            label={label}
                            hotkey={hotkey}
                            showTooltip={hoveredId === id}
                            onHoverChange={(h) =>
                                setHoveredId((cur) => (h ? id : cur === id ? null : cur))
                            }
                            onClick={() => setTool(id)}
                            ariaLabel={label}
                        >
                            <Icon size={17} />
                        </ToolButton>
                    );
                })}

                {/* Single eraser button. Defaults to object eraser; when an
                    eraser is already active, clicking again toggles between
                    the two variants for power users who don't want to mouse
                    down to the sub-row. */}
                <ToolButton
                    active={eraserActive}
                    label={
                        tool === 'pixel-eraser'
                            ? 'Pixel eraser'
                            : tool === 'eraser'
                                ? 'Object eraser'
                                : 'Eraser'
                    }
                    hotkey="E"
                    showTooltip={hoveredId === 'eraser'}
                    onHoverChange={(h) =>
                        setHoveredId((cur) => (h ? 'eraser' : cur === 'eraser' ? null : cur))
                    }
                    onClick={() => {
                        if (tool === 'eraser') setTool('pixel-eraser');
                        else setTool('eraser');
                    }}
                    ariaLabel="Eraser"
                >
                    <Eraser size={17} />
                </ToolButton>
            </div>

            <EraserSubOptions />
        </>
    );
}

interface EraserOption {
    id: Extract<Tool, 'eraser' | 'pixel-eraser'>;
    label: string;
}

const ERASER_OPTIONS: EraserOption[] = [
    { id: 'eraser', label: 'Object' },
    { id: 'pixel-eraser', label: 'Pixel' },
];

/**
 * Horizontal segmented toggle that mirrors the FILL / OUTLINE pattern used
 * inside ColorPalette. Visible only while an eraser tool is active.
 */
function EraserSubOptions() {
    const tool = useCanvasUI((s) => s.tool);
    const setTool = useCanvasUI((s) => s.setTool);

    const visible = tool === 'eraser' || tool === 'pixel-eraser';

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="eraser-suboptions"
                    data-canvas-chrome="eraser-suboptions"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0.3, 1] }}
                    className="pointer-events-auto absolute left-1/2 top-15 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-xl px-2.5 py-2"
                    style={{
                        background: 'rgba(20,15,10,0.78)',
                        border: '1px solid rgba(190,148,96,0.16)',
                        backdropFilter: 'blur(18px)',
                        boxShadow: '0 12px 32px -10px rgba(0,0,0,0.6)',
                    }}
                >
                    <div
                        role="group"
                        aria-label="Eraser mode"
                        className="flex items-center gap-0.5 rounded-lg p-0.5"
                        style={{ background: 'rgba(237,228,208,0.06)' }}
                    >
                        {ERASER_OPTIONS.map(({ id, label }) => {
                            const active = tool === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={active}
                                    title={
                                        id === 'eraser'
                                            ? 'Click a node or stroke to delete it'
                                            : 'Drag to erase only the part of strokes under the cursor'
                                    }
                                    onClick={() => setTool(id)}
                                    className="rounded-md px-3 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors"
                                    style={
                                        active
                                            ? { background: '#ede4d0', color: '#0b0906' }
                                            : { background: 'transparent', color: 'rgba(237,228,208,0.72)' }
                                    }
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

interface ToolButtonProps {
    active: boolean;
    label: string;
    hotkey: string;
    showTooltip: boolean;
    onHoverChange: (hovered: boolean) => void;
    onClick: () => void;
    ariaLabel: string;
    children: React.ReactNode;
}

/** Single toolbar button with an animated tooltip below it. */
function ToolButton({
    active,
    label,
    hotkey,
    showTooltip,
    onHoverChange,
    onClick,
    ariaLabel,
    children,
}: ToolButtonProps) {
    return (
        <div
            className="relative"
            onPointerEnter={() => onHoverChange(true)}
            onPointerLeave={() => onHoverChange(false)}
        >
            <button
                type="button"
                aria-pressed={active}
                aria-label={ariaLabel}
                onClick={onClick}
                onFocus={() => onHoverChange(true)}
                onBlur={() => onHoverChange(false)}
                className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                )}
                style={
                    active
                        ? { background: '#ede4d0', color: '#0b0906' }
                        : {
                            background: 'transparent',
                            color: 'rgba(237,228,208,0.72)',
                        }
                }
                onMouseEnter={(e) => {
                    if (!active) {
                        e.currentTarget.style.background = 'rgba(190,148,96,0.12)';
                        e.currentTarget.style.color = '#ede4d0';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(237,228,208,0.72)';
                    }
                }}
            >
                {children}
            </button>

            <AnimatePresence>
                {showTooltip && (
                    <motion.div
                        key="tip"
                        role="tooltip"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                        transition={{
                            opacity: { duration: 0.16, ease: [0.32, 0.72, 0.3, 1] },
                            y: { duration: 0.18, ease: [0.32, 0.72, 0.3, 1] },
                            // Subtle delay so quickly grazing the toolbar
                            // doesn't strobe a pile of tooltips.
                            delay: 0.08,
                        }}
                        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] font-medium"
                        style={{
                            background: 'rgba(11,9,6,0.95)',
                            color: '#ede4d0',
                            border: '1px solid rgba(190,148,96,0.22)',
                            boxShadow: '0 8px 22px -10px rgba(0,0,0,0.65)',
                        }}
                    >
                        {label}
                        <span
                            className="ml-1.5 rounded px-1.5 py-px text-[10px]"
                            style={{
                                background: 'rgba(237,228,208,0.10)',
                                color: 'rgba(237,228,208,0.7)',
                            }}
                        >
                            {hotkey}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
