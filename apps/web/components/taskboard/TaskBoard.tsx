'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelRightClose, PanelRightOpen, ListChecks } from 'lucide-react';
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
    collapsed: boolean;
    onToggle: () => void;
}

const EASE = [0.32, 0.72, 0.3, 1] as const;

const BADGE_COLORS = [
    'bg-rose-500/15 text-rose-300 border-rose-500/25',
    'bg-orange-500/15 text-orange-300 border-orange-500/25',
    'bg-amber-500/15 text-amber-300 border-amber-500/25',
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    'bg-sky-500/15 text-sky-300 border-sky-500/25',
    'bg-violet-500/15 text-violet-300 border-violet-500/25',
    'bg-pink-500/15 text-pink-300 border-pink-500/25',
    'bg-teal-500/15 text-teal-300 border-teal-500/25',
];

function authorColor(authorId: string): string {
    let hash = 0;
    for (let i = 0; i < authorId.length; i++) hash = (hash * 31 + authorId.charCodeAt(i)) | 0;
    return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]!;
}

function jumpToNode(nodeId: string): void {
    window.dispatchEvent(new CustomEvent('ligma:jump-to-node', { detail: { nodeId } }));
}

export function TaskBoard({ room, collapsed, onToggle }: TaskBoardProps) {
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
        <motion.div
            data-canvas-chrome="task-board"
            initial={false}
            animate={{ width: collapsed ? 44 : 320 }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={collapsed ? onToggle : undefined}
            className="relative flex h-full shrink-0 flex-col overflow-hidden border-l"
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
                        <PanelRightOpen size={16} style={{ color: 'rgba(237,228,208,0.72)', flexShrink: 0 }} />
                        <span
                            style={{
                                writingMode: 'vertical-rl',
                                color: 'rgba(237,228,208,0.55)',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.06em',
                                userSelect: 'none',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Task Board
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
                            <div className="flex flex-1 items-center gap-2 pl-1">
                                <ListChecks size={14} style={{ color: 'rgba(190,148,96,0.85)' }} />
                                <span
                                    className="text-[12.5px] font-semibold tracking-wide"
                                    style={{ color: '#ede4d0' }}
                                >
                                    Task Board
                                </span>
                                <span
                                    className="ml-auto rounded-full px-2 py-0.5 text-[10px]"
                                    style={{
                                        background: 'rgba(237,228,208,0.08)',
                                        color: 'rgba(237,228,208,0.6)',
                                    }}
                                >
                                    {open.length} open
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={onToggle}
                                title="Collapse task board"
                                aria-label="Collapse task board"
                                className="ml-2 flex h-8 w-8 flex-none items-center justify-center rounded-md transition-colors"
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
                                <PanelRightClose size={16} />
                            </button>
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
                        {tasks.length === 0 ? (
                            <div className="flex flex-col items-center gap-1.5 p-6 text-center">
                                <p
                                    className="text-[12px]"
                                    style={{ color: 'rgba(237,228,208,0.45)' }}
                                >
                                    No action items yet
                                </p>
                                <p
                                    className="text-[11px] leading-relaxed"
                                    style={{ color: 'rgba(237,228,208,0.32)' }}
                                >
                                    AI auto-classifies canvas text and promotes action items
                                    to this board.
                                </p>
                            </div>
                        ) : (
                            <div
                                className="divide-y"
                                style={{ borderColor: 'rgba(190,148,96,0.1)' }}
                            >
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
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
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
            // content is Y.Text — call toString() to get the plain string
            setNodeContent(raw && typeof (raw as { toString(): string }).toString === 'function'
                ? (raw as { toString(): string }).toString()
                : String(raw ?? ''));
        }
        readContent();
        room.nodes.observe(readContent);
        return () => room.nodes.unobserve(readContent);
    }, [task.nodeId, room.nodes]);

    const done = task.status === 'done';

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: done ? 0.5 : 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="px-3 py-2.5"
            style={{ borderColor: 'rgba(190,148,96,0.08)' }}
        >
            <div className="flex items-start gap-2">
                <button
                    onClick={() => onToggle(task)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors"
                    style={{
                        borderColor: done
                            ? 'rgba(190,148,96,0.5)'
                            : 'rgba(190,148,96,0.35)',
                        background: done ? 'rgba(190,148,96,0.5)' : 'transparent',
                    }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <p
                        className={`text-[12.5px] leading-snug ${done ? 'line-through' : ''}`}
                        style={{ color: 'rgba(237,228,208,0.85)' }}
                    >
                        {nodeContent || (
                            <span
                                className="italic"
                                style={{ color: 'rgba(237,228,208,0.35)' }}
                            >
                                empty node
                            </span>
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                        <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}
                        >
                            {task.authorName}
                        </span>
                        <span
                            className="font-mono text-[10px]"
                            style={{ color: 'rgba(237,228,208,0.4)' }}
                        >
                            {new Date(task.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                        <button
                            onClick={() => onJump(task.nodeId)}
                            className="ml-auto text-[11px] transition-colors"
                            style={{ color: 'rgba(237,228,208,0.5)' }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ede4d0';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(237,228,208,0.5)';
                            }}
                        >
                            Jump →
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
