'use client';

/**
 * TimelineReplay — A11 deliverable.
 *
 * Bottom-anchored panel that lets users scrub through the room's recorded
 * event log. Replay is purely visual: the live Y.Doc is never mutated by
 * the scrubber. While replaying, the canvas renders a derived snapshot
 * (see ReplayNodeLayer) and editing is disabled.
 *
 * UI surface:
 *   - Toggle button (collapsed -> small "History" pill in the corner)
 *   - Slider (0 .. events.length) with live position label
 *   - ◁◁ / ◁ / ▷ / ▷▷ step buttons
 *   - ▶ / ⏸ playback (200ms per event by default)
 *   - "Live" button to exit replay (sets replayIndex back to null)
 *
 * Keyboard shortcut: `H` toggles the panel.
 */

import { useEffect, useRef, useState } from 'react';
import {
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
    History,
    Pause,
    Play,
    X,
} from 'lucide-react';
import type { RecordedEvent } from '@/lib/types';
import { useCanvasUI } from '@/lib/canvas-store';

interface TimelineReplayProps {
    events: RecordedEvent[];
}

const PLAYBACK_INTERVAL_MS = 220;

function formatOrigin(origin: string): string {
    return origin
        .replace(/-/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase());
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function TimelineReplay({ events }: TimelineReplayProps) {
    const [open, setOpen] = useState(false);
    const [playing, setPlaying] = useState(false);
    const replayIndex = useCanvasUI((s) => s.replayIndex);
    const setReplayIndex = useCanvasUI((s) => s.setReplayIndex);

    const max = events.length;
    // When NOT replaying we still show a slider at max for context.
    const sliderValue = replayIndex ?? max;

    // Stop playback when we've reached the end.
    useEffect(() => {
        if (playing && sliderValue >= max) setPlaying(false);
    }, [playing, sliderValue, max]);

    // Stop playback if we leave replay mode.
    useEffect(() => {
        if (replayIndex === null && playing) setPlaying(false);
    }, [replayIndex, playing]);

    // Drive playback timer.
    const playingRef = useRef(playing);
    playingRef.current = playing;
    useEffect(() => {
        if (!playing) return;
        const id = window.setInterval(() => {
            // Read fresh values from the store each tick.
            const idx = useCanvasUI.getState().replayIndex ?? max;
            if (idx >= max) {
                setPlaying(false);
                return;
            }
            useCanvasUI.getState().setReplayIndex(idx + 1);
        }, PLAYBACK_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [playing, max]);

    // Hotkey: H toggles, Left/Right arrow steps when in replay mode.
    useEffect(() => {
        function isTyping(target: EventTarget | null): boolean {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
        }
        function onKey(e: KeyboardEvent) {
            if (isTyping(e.target)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'h' || e.key === 'H') {
                setOpen((o) => !o);
            } else if (replayIndex !== null) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setReplayIndex(Math.max(0, replayIndex - 1));
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setReplayIndex(Math.min(max, replayIndex + 1));
                }
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [replayIndex, setReplayIndex, max]);

    function enterReplay(at: number) {
        setReplayIndex(Math.max(0, Math.min(max, at)));
    }
    function exitReplay() {
        setReplayIndex(null);
        setPlaying(false);
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-black/80"
                title="Time travel (H)"
            >
                <History size={13} />
                History
            </button>
        );
    }

    const evAtCursor =
        replayIndex !== null && replayIndex > 0 ? events[replayIndex - 1] : null;

    return (
        <div
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 z-20 w-[min(640px,calc(100%-24px))] -translate-x-1/2 rounded-lg bg-black/85 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur"
        >
            <header className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold">
                    <History size={13} />
                    Time Travel
                    {replayIndex !== null && (
                        <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black">
                            REPLAY
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close timeline"
                    className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
                >
                    <X size={13} />
                </button>
            </header>

            <div className="mb-2 flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => enterReplay(0)}
                    disabled={max === 0}
                    aria-label="Jump to start"
                    className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                    <ChevronFirst size={14} />
                </button>
                <button
                    type="button"
                    onClick={() =>
                        enterReplay(Math.max(0, (replayIndex ?? max) - 1))
                    }
                    disabled={max === 0 || (replayIndex ?? max) <= 0}
                    aria-label="Step back"
                    className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                    <ChevronLeft size={14} />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (replayIndex === null) enterReplay(0);
                        setPlaying((p) => !p);
                    }}
                    disabled={max === 0}
                    aria-label={playing ? 'Pause' : 'Play'}
                    className="rounded bg-blue-600 p-1 text-white hover:bg-blue-500 disabled:opacity-40"
                >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                    type="button"
                    onClick={() =>
                        enterReplay(Math.min(max, (replayIndex ?? max) + 1))
                    }
                    disabled={max === 0 || (replayIndex ?? max) >= max}
                    aria-label="Step forward"
                    className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                    <ChevronRight size={14} />
                </button>
                <button
                    type="button"
                    onClick={() => enterReplay(max)}
                    disabled={max === 0}
                    aria-label="Jump to end"
                    className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                    <ChevronLast size={14} />
                </button>

                <div className="ml-2 flex-1">
                    <input
                        type="range"
                        min={0}
                        max={Math.max(max, 1)}
                        value={sliderValue}
                        onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v >= max) exitReplay();
                            else enterReplay(v);
                        }}
                        disabled={max === 0}
                        aria-label="Replay position"
                        className="w-full accent-blue-500"
                    />
                </div>

                <button
                    type="button"
                    onClick={exitReplay}
                    disabled={replayIndex === null}
                    className="ml-2 rounded bg-white/10 px-2 py-1 text-[11px] font-medium hover:bg-white/20 disabled:opacity-40"
                >
                    Live
                </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-white/70">
                <div>
                    {replayIndex === null ? (
                        <span>
                            Live — {max} event{max === 1 ? '' : 's'} recorded
                        </span>
                    ) : (
                        <span>
                            Event {replayIndex} / {max}
                            {evAtCursor && (
                                <>
                                    {' · '}
                                    <span className="font-mono">
                                        {formatOrigin(evAtCursor.origin)}
                                    </span>
                                    {' · '}
                                    <span className="text-white/50">
                                        {formatTime(evAtCursor.ts)}
                                    </span>
                                </>
                            )}
                        </span>
                    )}
                </div>
                <div className="text-white/40">H to toggle · ← → step</div>
            </div>
        </div>
    );
}
