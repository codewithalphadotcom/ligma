'use client';

/**
 * Toolbar — floating top-centre tool picker for the canvas.
 *
 * Tools determine what a left-click on the empty canvas does:
 *   select  — pan only
 *   sticky  — place a sticky note at the click point
 *   rect    — place a rectangle
 *   circle  — place a circle
 *   text    — place a text block
 *   draw    — freehand drawing (down → start stroke, move → append, up → end)
 *
 * Press 1–6 to switch tools. ESC returns to select.
 */

import { useEffect } from 'react';
import {
    MousePointer2,
    StickyNote as StickyNoteIcon,
    Square,
    Circle,
    Type,
    Pencil,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCanvasUI } from '@/lib/canvas-store';
import type { Tool } from '@/lib/types';

interface ToolDef {
    id: Tool;
    label: string;
    hotkey: string;
    Icon: React.ComponentType<{ size?: number }>;
}

const TOOLS: ToolDef[] = [
    { id: 'select', label: 'Select / pan', hotkey: '1', Icon: MousePointer2 },
    { id: 'sticky', label: 'Sticky note', hotkey: '2', Icon: StickyNoteIcon },
    { id: 'rect', label: 'Rectangle', hotkey: '3', Icon: Square },
    { id: 'circle', label: 'Circle', hotkey: '4', Icon: Circle },
    { id: 'text', label: 'Text', hotkey: '5', Icon: Type },
    { id: 'draw', label: 'Draw', hotkey: '6', Icon: Pencil },
];

export function Toolbar() {
    const tool = useCanvasUI((s) => s.tool);
    const setTool = useCanvasUI((s) => s.setTool);

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
            const t = TOOLS.find((x) => x.hotkey === e.key);
            if (t) {
                e.preventDefault();
                setTool(t.id);
            }
        }

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [setTool]);

    return (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1 rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/10 dark:bg-neutral-800 dark:ring-white/10">
            {TOOLS.map(({ id, label, hotkey, Icon }) => {
                const active = tool === id;
                return (
                    <button
                        key={id}
                        type="button"
                        title={`${label} (${hotkey})`}
                        aria-pressed={active}
                        aria-label={label}
                        onClick={() => setTool(id)}
                        className={cn(
                            'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                            active
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700',
                        )}
                    >
                        <Icon size={18} />
                    </button>
                );
            })}
        </div>
    );
}
