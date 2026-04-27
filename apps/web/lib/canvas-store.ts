'use client';

/**
 * Per-tab canvas UI state — separate from the room's shared Y.Doc because
 * tool selection, selection set, and replay scrub state are personal-view
 * concerns, not collaborative ones.
 *
 * Lives in zustand so any component (toolbar, canvas, status hint, replay
 * scrubber, comment popover) can read or write without prop drilling.
 */

import { create } from 'zustand';
import type { Tool } from './types';

interface CanvasUIState {
    // ---- Tool ----
    tool: Tool;
    setTool: (t: Tool) => void;

    // ---- Selection (A8) ----
    /** Set of selected node ids. Stored as Set for O(1) membership checks. */
    selection: Set<string>;
    /** Replace the selection with a single id. */
    selectOnly: (id: string) => void;
    /** Replace the selection with the given ids. */
    selectMany: (ids: string[]) => void;
    /** Toggle id in/out of the selection (Shift-click). */
    toggleSelected: (id: string) => void;
    /** Add ids to the selection (additive marquee). */
    addToSelection: (ids: string[]) => void;
    /** Clear all selected ids. */
    clearSelection: () => void;
    /** Remove specific ids from the selection (used after delete). */
    removeFromSelection: (ids: string[]) => void;

    // ---- Comment popover (A10) ----
    /** Node id whose comment thread is currently visible, or null. */
    commentOpenId: string | null;
    /** Toggle a node's comment popover. Pass null to close. */
    setCommentOpen: (id: string | null) => void;

    // ---- Time-Travel Replay (A11) ----
    /**
     * If null, the canvas renders the live Y.Doc. Otherwise the canvas
     * renders the snapshot at this event index (0 = baseline, N = after N
     * recorded updates have been applied).
     */
    replayIndex: number | null;
    setReplayIndex: (i: number | null) => void;
    /** Convenience: true iff replay mode is active. */
    isReplaying: () => boolean;
}

export const useCanvasUI = create<CanvasUIState>((set, get) => ({
    tool: 'select',
    setTool: (t) => set({ tool: t }),

    selection: new Set<string>(),
    selectOnly: (id) => set({ selection: new Set([id]) }),
    selectMany: (ids) => set({ selection: new Set(ids) }),
    toggleSelected: (id) =>
        set((s) => {
            const next = new Set(s.selection);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return { selection: next };
        }),
    addToSelection: (ids) =>
        set((s) => {
            if (ids.length === 0) return {};
            const next = new Set(s.selection);
            for (const id of ids) next.add(id);
            return { selection: next };
        }),
    clearSelection: () =>
        set((s) => (s.selection.size === 0 ? {} : { selection: new Set() })),
    removeFromSelection: (ids) =>
        set((s) => {
            if (s.selection.size === 0 || ids.length === 0) return {};
            const next = new Set(s.selection);
            let changed = false;
            for (const id of ids) {
                if (next.delete(id)) changed = true;
            }
            return changed ? { selection: next } : {};
        }),

    commentOpenId: null,
    setCommentOpen: (id) => set({ commentOpenId: id }),

    replayIndex: null,
    setReplayIndex: (i) => set({ replayIndex: i }),
    isReplaying: () => get().replayIndex !== null,
}));

