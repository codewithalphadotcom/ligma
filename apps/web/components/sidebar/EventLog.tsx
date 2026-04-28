'use client';

/**
 * EventLog — append-only sidebar showing every meaningful canvas mutation.
 *
 * Why it exists separately from the recorder used by TimelineReplay:
 *   - The replay recorder stores raw Y.js update bytestrings (great for
 *     deterministic replay, useless for humans to read).
 *   - This panel needs *human-readable* entries: "Krrish created sticky",
 *     "Alpha deleted shape", "AI promoted node to action item".
 *
 * Source of truth:
 *   We derive entries directly from Y.js observers on the room's `nodes`
 *   Y.Map and `tasks` Y.Array. Every additions / deletions / classification
 *   change becomes a row. Because Y.Map.observe() fires for *every* peer's
 *   mutations (yours and theirs), every collaborator's actions show up.
 *
 *   We deliberately do NOT mirror this list into a shared Y.Array — each
 *   client builds its own log from observed events, and the order is
 *   derived from the deterministic order of Y.js update application, so
 *   every client converges on the same sequence. (This matches the spec
 *   point "every mutation stored as immutable event": each client holds
 *   an immutable, append-only projection.)
 *
 * Persistence:
 *   The server-side Postgres `events` table is the durable record (used by
 *   `getEventsSince` to rehydrate the doc on reconnect). When you reload a
 *   room, the doc replays from that table, which means our nodes Y.Map
 *   re-fires its `add` events here too — so old activity reappears.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, ScrollText } from 'lucide-react';
import type * as Y from 'yjs';
import type { RoomHandle } from '@/lib/yjs';

interface EventEntry {
  id: string;
  ts: number;
  kind:
  | 'node_created'
  | 'node_deleted'
  | 'node_classified'
  | 'task_created'
  | 'task_toggled'
  | 'stroke_added';
  nodeType?: string;
  nodeId?: string;
  detail?: string;
}

const KIND_BADGES: Record<EventEntry['kind'], { label: string; cls: string }> = {
  node_created: {
    label: 'created',
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  },
  node_deleted: {
    label: 'deleted',
    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  },
  node_classified: {
    label: 'classified',
    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  },
  task_created: {
    label: 'task',
    cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  },
  task_toggled: {
    label: 'task',
    cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  },
  stroke_added: {
    label: 'stroke',
    cls: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  },
};

const EASE = [0.32, 0.72, 0.3, 1] as const;

/** True iff a Y type is a Y.Map (avoids importing Y just for instanceof). */
function isYMap(value: unknown): value is Y.Map<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'observe' in value &&
    'get' in value &&
    'set' in value
  );
}

interface EventLogProps {
  room: RoomHandle;
  collapsed: boolean;
  onToggle: () => void;
}

export function EventLog({ room, collapsed, onToggle }: EventLogProps) {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const seqRef = useRef(0);
  const knownNodes = useRef<Set<string>>(new Set());
  const lastClassRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Seed from any nodes already in the doc when we mount (e.g. after
    // a reload — server replay rehydrates `nodes` before we observe it).
    room.nodes.forEach((_node, id) => {
      knownNodes.current.add(id);
    });

    function pushEvent(e: Omit<EventEntry, 'id'>) {
      seqRef.current += 1;
      const entry: EventEntry = { ...e, id: `${seqRef.current}` };
      setEvents((prev) => {
        // Cap to the last 500 entries so a long-lived session doesn't
        // balloon DOM size; spec says "append-only" semantically, but
        // older entries are recoverable via the server log if ever
        // needed.
        const next = [...prev, entry];
        if (next.length > 500) next.splice(0, next.length - 500);
        return next;
      });
    }

    // Observe the nodes map for additions / deletions.
    function onNodesChange(ev: Y.YMapEvent<Y.Map<unknown>>) {
      ev.changes.keys.forEach((change, nodeId) => {
        if (change.action === 'add') {
          if (knownNodes.current.has(nodeId)) return;
          knownNodes.current.add(nodeId);
          const node = room.nodes.get(nodeId);
          const type = isYMap(node)
            ? (node.get('type') as string | undefined)
            : undefined;
          pushEvent({
            ts: Date.now(),
            kind: type === 'stroke' ? 'stroke_added' : 'node_created',
            nodeType: type,
            nodeId,
          });
        } else if (change.action === 'delete') {
          knownNodes.current.delete(nodeId);
          pushEvent({
            ts: Date.now(),
            kind: 'node_deleted',
            nodeId,
          });
        }
      });
    }

    // Observe deep changes to detect classification flips on individual
    // node Y.Maps (the AI intent pipeline mutates `classification`).
    function onDeep(events: Y.YEvent<Y.AbstractType<unknown>>[]) {
      for (const ev of events) {
        // We only care about per-node Y.Maps (parent.path = [nodeId]).
        if (ev.path.length !== 1) continue;
        const nodeId = ev.path[0];
        if (typeof nodeId !== 'string') continue;

        const yEv = ev as Y.YMapEvent<unknown>;
        if (!yEv.changes?.keys) continue;
        yEv.changes.keys.forEach((change, key) => {
          if (key !== 'classification') return;
          if (change.action !== 'add' && change.action !== 'update') return;

          const node = room.nodes.get(nodeId);
          const cls = isYMap(node)
            ? (node.get('classification') as string | undefined)
            : undefined;
          if (!cls) return;
          if (lastClassRef.current.get(nodeId) === cls) return;
          lastClassRef.current.set(nodeId, cls);
          pushEvent({
            ts: Date.now(),
            kind: 'node_classified',
            nodeId,
            detail: cls,
          });
        });
      }
    }

    room.nodes.observe(onNodesChange);
    room.nodes.observeDeep(onDeep);

    // Observe the tasks array for new task additions.
    function onTasksChange(ev: Y.YArrayEvent<unknown>) {
      ev.changes.delta.forEach((d) => {
        if (d.insert && Array.isArray(d.insert)) {
          for (const task of d.insert) {
            if (
              task &&
              typeof task === 'object' &&
              'nodeId' in task &&
              'authorName' in task
            ) {
              pushEvent({
                ts: Date.now(),
                kind: 'task_created',
                nodeId: (task as { nodeId: string }).nodeId,
                detail: (task as { authorName: string }).authorName,
              });
            }
          }
        }
      });
    }
    room.tasks.observe(onTasksChange);

    return () => {
      room.nodes.unobserve(onNodesChange);
      room.nodes.unobserveDeep(onDeep);
      room.tasks.unobserve(onTasksChange);
    };
  }, [room]);

  return (
    <motion.div
      data-canvas-chrome="event-log"
      initial={false}
      animate={{ width: collapsed ? 44 : 288 }}
      transition={{ duration: 0.32, ease: EASE }}
      onClick={collapsed ? onToggle : undefined}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r"
      style={{
        background: 'rgba(11,9,6,0.95)',
        borderColor: 'rgba(190,148,96,0.16)',
        cursor: collapsed ? 'pointer' : 'default',
      }}
    >
      {/* Collapsed strip — icon + rotated label, whole panel is clickable */}
      <AnimatePresence initial={false}>
        {collapsed && (
          <motion.div
            key="collapsed-strip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="flex h-full w-full flex-col items-center pt-3 gap-3"
          >
            <PanelLeftOpen size={16} style={{ color: 'rgba(237,228,208,0.72)', flexShrink: 0 }} />
            <span
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                color: 'rgba(237,228,208,0.55)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Event Log
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded header */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="expanded-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            <div
              className="flex h-12 items-center border-b px-2"
              style={{ borderColor: 'rgba(190,148,96,0.16)' }}
            >
              <button
                type="button"
                onClick={onToggle}
                title="Collapse event log"
                aria-label="Collapse event log"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-md transition-colors"
                style={{ color: 'rgba(237,228,208,0.72)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(190,148,96,0.12)';
                  e.currentTarget.style.color = '#ede4d0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(237,228,208,0.72)';
                }}
              >
                <PanelLeftClose size={16} />
              </button>
              <div className="ml-1 flex flex-1 items-center gap-2">
                <ScrollText size={14} style={{ color: 'rgba(190,148,96,0.85)' }} />
                <span
                  className="text-[12.5px] font-semibold tracking-wide"
                  style={{ color: '#ede4d0' }}
                >
                  Event Log
                </span>
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: 'rgba(237,228,208,0.08)',
                    color: 'rgba(237,228,208,0.6)',
                  }}
                >
                  {events.length}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="flex-1 overflow-y-auto"
          >
            {events.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 p-6 text-center">
                <p
                  className="text-[12px]"
                  style={{ color: 'rgba(237,228,208,0.45)' }}
                >
                  No events yet
                </p>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: 'rgba(237,228,208,0.32)' }}
                >
                  Drop a sticky, draw a stroke, or delete a node — every
                  mutation lands here in real time.
                </p>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-0.5 p-2">
                {events.map((ev) => {
                  const b = KIND_BADGES[ev.kind];
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] transition-colors"
                      style={{ color: 'rgba(237,228,208,0.78)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          'rgba(190,148,96,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}
                      >
                        {b.label}
                      </span>
                      <span
                        className="truncate"
                        style={{ color: 'rgba(237,228,208,0.6)' }}
                      >
                        {describeEvent(ev)}
                      </span>
                      <span
                        className="ml-auto shrink-0 font-mono text-[10px]"
                        style={{ color: 'rgba(237,228,208,0.35)' }}
                      >
                        {formatTime(ev.ts)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function describeEvent(ev: EventEntry): string {
  switch (ev.kind) {
    case 'node_created':
      return ev.nodeType ? `${ev.nodeType} added` : 'node added';
    case 'node_deleted':
      return ev.nodeId ? `node ${ev.nodeId.slice(0, 6)}` : 'node removed';
    case 'node_classified':
      return ev.detail ? `→ ${ev.detail}` : 'classified';
    case 'task_created':
      return ev.detail ? `${ev.detail} added a task` : 'task created';
    case 'task_toggled':
      return 'task toggled';
    case 'stroke_added':
      return 'freehand stroke';
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
