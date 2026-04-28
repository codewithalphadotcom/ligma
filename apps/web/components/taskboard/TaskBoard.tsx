'use client';

import { useEffect, useState } from 'react';
import type { RoomHandle } from '@/lib/yjs';

interface TaskData {
  id: string;
  nodeId: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  status: 'open' | 'done';
}

interface TaskBoardProps {
  room: RoomHandle;
}

const BADGE_COLORS = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-yellow-100 text-yellow-700',
  'bg-green-100 text-green-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];

function authorColor(authorId: string): string {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) hash = (hash * 31 + authorId.charCodeAt(i)) | 0;
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]!;
}

function jumpToNode(nodeId: string): void {
  window.dispatchEvent(new CustomEvent('ligma:jump-to-node', { detail: { nodeId } }));
}

export function TaskBoard({ room }: TaskBoardProps) {
  const [tasks, setTasks] = useState<TaskData[]>([]);

  useEffect(() => {
    function sync() {
      setTasks(room.tasks.toArray() as TaskData[]);
    }
    sync();
    room.tasks.observe(sync);
    return () => room.tasks.unobserve(sync);
  }, [room.tasks]);

  function toggleStatus(task: TaskData) {
    const idx = room.tasks.toArray().findIndex((t) => (t as TaskData).id === task.id);
    if (idx === -1) return;
    room.doc.transact(() => {
      const updated = { ...task, status: task.status === 'open' ? 'done' : 'open' };
      room.tasks.delete(idx, 1);
      room.tasks.insert(idx, [updated]);
    }, 'task-toggle');
  }

  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <span className="text-sm font-semibold">Task Board</span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {open.length} open
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-sm text-neutral-400">No action items yet</p>
            <p className="text-xs text-neutral-400">
              AI will auto-classify canvas text and add tasks here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {[...open, ...done].map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                room={room}
                onToggle={toggleStatus}
                onJump={jumpToNode}
                colorClass={authorColor(task.authorId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: TaskData;
  room: RoomHandle;
  onToggle: (task: TaskData) => void;
  onJump: (nodeId: string) => void;
  colorClass: string;
}

function TaskItem({ task, room, onToggle, onJump, colorClass }: TaskItemProps) {
  const [nodeContent, setNodeContent] = useState('');

  useEffect(() => {
    function readContent() {
      const node = room.nodes.get(task.nodeId);
      if (!node) return;
      const raw = node.get('content');
      setNodeContent(typeof raw === 'string' ? raw : String(raw ?? ''));
    }
    readContent();
    room.nodes.observe(readContent);
    return () => room.nodes.unobserve(readContent);
  }, [task.nodeId, room.nodes]);

  return (
    <div className={`px-4 py-3 ${task.status === 'done' ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => onToggle(task)}
          className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded border transition ${
            task.status === 'done'
              ? 'border-neutral-300 bg-neutral-300 dark:border-neutral-600 dark:bg-neutral-600'
              : 'border-neutral-300 hover:border-neutral-500 dark:border-neutral-600'
          }`}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className={`text-sm leading-snug ${task.status === 'done' ? 'line-through' : ''}`}>
            {nodeContent || <span className="italic text-neutral-400">empty node</span>}
          </p>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}>
              {task.authorName}
            </span>
            <span className="text-xs text-neutral-400">
              {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={() => onJump(task.nodeId)}
              className="ml-auto text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Jump →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
