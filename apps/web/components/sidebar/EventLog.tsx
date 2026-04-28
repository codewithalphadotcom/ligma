'use client';

import { useEffect, useRef, useState } from 'react';
import type { RoomHandle } from '@/lib/yjs';

interface EventEntry {
  seq: number;
  ts: number;
  origin: string;
  nodeId?: string;
}

const EVENT_BADGES: Record<string, { label: string; cls: string }> = {
  node_created:   { label: 'created',   cls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  node_updated:   { label: 'edited',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  node_deleted:   { label: 'deleted',   cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  stroke_added:   { label: 'stroke',    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  task_created:   { label: 'task',      cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  doc_update:     { label: 'update',    cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
};

function badge(origin: string) {
  return EVENT_BADGES[origin] ?? { label: origin, cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' };
}

interface EventLogProps {
  room: RoomHandle;
  collapsed: boolean;
  onToggle: () => void;
}

export function EventLog({ room, collapsed, onToggle }: EventLogProps) {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function sync() {
      setEvents([...(room.events.toArray() as EventEntry[])].reverse());
    }
    sync();
    room.events.observe(sync);
    return () => room.events.unobserve(sync);
  }, [room.events]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex w-8 flex-shrink-0 flex-col items-center justify-start gap-1 border-r border-neutral-200 bg-white pt-4 dark:border-neutral-800 dark:bg-neutral-950"
        title="Expand event log"
      >
        <span className="text-xs text-neutral-400">▶</span>
        <span
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          className="text-xs font-medium text-neutral-400"
        >
          Event Log
        </span>
      </button>
    );
  }

  return (
    <div className="flex w-72 flex-shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <span className="text-sm font-semibold">Event Log</span>
        <button
          onClick={onToggle}
          className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          title="Collapse"
        >
          ◀
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {events.length === 0 ? (
          <p className="p-4 text-center text-xs text-neutral-400">No events yet</p>
        ) : (
          <div className="space-y-1">
            {events.map((ev, i) => {
              const b = badge(ev.origin);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 font-medium ${b.cls}`}>
                    {b.label}
                  </span>
                  {ev.nodeId && (
                    <span className="truncate font-mono text-neutral-400">
                      {ev.nodeId.slice(0, 8)}
                    </span>
                  )}
                  <span className="ml-auto flex-shrink-0 text-neutral-400">
                    {new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
