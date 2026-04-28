'use client';

/**
 * ZoomDock — Excalidraw-style bottom-left controls.
 *
 *  [ − ]  100%  [ + ]   |   [ ↶ ]  [ ↷ ]
 *
 * Zoom buttons control a viewport state owned by Canvas (passed in as
 * callbacks). Undo/redo drive a Y.UndoManager scoped to the room's nodes
 * map.
 */

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { Minus, Plus, Redo2, Undo2 } from 'lucide-react';

interface ZoomDockProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    undoManager: Y.UndoManager | null;
}

export function ZoomDock({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    undoManager,
}: ZoomDockProps) {
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    useEffect(() => {
        if (!undoManager) return;
        const update = () => {
            setCanUndo(undoManager.undoStack.length > 0);
            setCanRedo(undoManager.redoStack.length > 0);
        };
        update();
        undoManager.on('stack-item-added', update);
        undoManager.on('stack-item-popped', update);
        undoManager.on('stack-cleared', update);
        return () => {
            undoManager.off('stack-item-added', update);
            undoManager.off('stack-item-popped', update);
            undoManager.off('stack-cleared', update);
        };
    }, [undoManager]);

    // Keyboard shortcuts: Cmd/Ctrl-Z and Cmd/Ctrl-Shift-Z (or Cmd/Ctrl-Y).
    useEffect(() => {
        if (!undoManager) return;
        function onKeyDown(e: KeyboardEvent) {
            if (!(e.metaKey || e.ctrlKey)) return;
            const target = e.target;
            if (
                target instanceof HTMLElement &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable)
            ) {
                return;
            }
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undoManager!.undo();
            } else if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault();
                undoManager!.redo();
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [undoManager]);

    const btnBase =
        'flex h-9 w-9 items-center justify-center rounded-md transition-colors';
    const btnEnabled = 'hover:bg-[rgba(190,148,96,0.12)]';
    const btnDisabled = 'opacity-30 cursor-not-allowed';

    const dockStyle: React.CSSProperties = {
        background: 'rgba(20,15,10,0.78)',
        border: '1px solid rgba(190,148,96,0.16)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 12px 32px -10px rgba(0,0,0,0.6)',
        color: '#ede4d0',
    };

    return (
        <div
            data-canvas-chrome="zoom-dock"
            className="pointer-events-auto absolute bottom-4 left-4 z-30 flex items-center gap-1"
        >
            {/* Zoom group */}
            <div className="flex items-center gap-0.5 rounded-lg p-1" style={dockStyle}>
                <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={onZoomOut}
                    className={`${btnBase} ${btnEnabled}`}
                >
                    <Minus size={15} strokeWidth={2.25} />
                </button>
                <button
                    type="button"
                    aria-label="Reset zoom"
                    onClick={onResetZoom}
                    className="flex h-9 min-w-14.5 items-center justify-center rounded-md px-2 font-mono text-[12px] font-medium transition-colors hover:bg-[rgba(190,148,96,0.12)]"
                    title="Reset zoom"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={onZoomIn}
                    className={`${btnBase} ${btnEnabled}`}
                >
                    <Plus size={15} strokeWidth={2.25} />
                </button>
            </div>

            {/* Undo / redo group */}
            <div className="flex items-center gap-0.5 rounded-lg p-1" style={dockStyle}>
                <button
                    type="button"
                    aria-label="Undo"
                    title="Undo (⌘Z)"
                    disabled={!canUndo}
                    onClick={() => undoManager?.undo()}
                    className={`${btnBase} ${canUndo ? btnEnabled : btnDisabled}`}
                >
                    <Undo2 size={15} strokeWidth={2.25} />
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    title="Redo (⌘⇧Z)"
                    disabled={!canRedo}
                    onClick={() => undoManager?.redo()}
                    className={`${btnBase} ${canRedo ? btnEnabled : btnDisabled}`}
                >
                    <Redo2 size={15} strokeWidth={2.25} />
                </button>
            </div>
        </div>
    );
}
