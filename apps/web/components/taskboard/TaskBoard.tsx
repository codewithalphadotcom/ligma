'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PanelRightClose,
    PanelRightOpen,
    ListChecks,
    Download,
    FileText,
    FileDown,
    Loader2,
    Sparkles,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { RoomHandle } from '@/lib/yjs';
import { api, ApiError } from '@/lib/api';

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
    // Live cache of nodeId → plain-text content. We need this both for the
    // <TaskItem> rows (already handled per-item) AND for the export flow,
    // which needs every task's content at button-click time.
    const [nodeContents, setNodeContents] = useState<Record<string, string>>({});

    useEffect(() => {
        function sync() {
            setTasks(room.tasks.toArray() as TaskData[]);
        }
        sync();
        room.tasks.observe(sync);
        return () => room.tasks.unobserve(sync);
    }, [room.tasks]);

    useEffect(() => {
        function readAll() {
            const out: Record<string, string> = {};
            room.nodes.forEach((node, id) => {
                const raw = node.get('content');
                out[id] =
                    raw && typeof (raw as { toString(): string }).toString === 'function'
                        ? (raw as { toString(): string }).toString()
                        : String(raw ?? '');
            });
            setNodeContents(out);
        }
        readAll();
        room.nodes.observeDeep(readAll);
        return () => room.nodes.unobserveDeep(readAll);
    }, [room.nodes]);

    function toggleStatus(task: TaskData) {
        const idx = room.tasks.toArray().findIndex((t) => (t as TaskData).id === task.id);
        if (idx === -1) return;
        room.doc.transact(() => {
            const updated = { ...task, status: task.status === 'open' ? 'done' : 'open' };
            room.tasks.delete(idx, 1);
            room.tasks.insert(idx, [updated]);
        }, 'task-toggle');
    }

    // Dedupe by nodeId. Tasks live in a Y.Array, so prior to the
    // "author-only classification" fix a node could end up with one task
    // per connected member. Collapse those into a single row (keep the
    // earliest one — that's the canonical task) so old rooms self-heal.
    const dedupedTasks = (() => {
        const seen = new Set<string>();
        const out: TaskData[] = [];
        for (const t of [...tasks].sort((a, b) => a.createdAt - b.createdAt)) {
            if (seen.has(t.nodeId)) continue;
            seen.add(t.nodeId);
            out.push(t);
        }
        return out;
    })();

    const open = dedupedTasks.filter((t) => t.status === 'open');
    const done = dedupedTasks.filter((t) => t.status === 'done');

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
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="flex-1 overflow-y-auto">
                            {dedupedTasks.length === 0 ? (
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
                        </div>
                        <ExportFooter
                            roomId={room.roomId}
                            tasks={dedupedTasks}
                            nodeContents={nodeContents}
                        />
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

// ---------------------------------------------------------------------------
// AI Summary Export — bonus feature
// ---------------------------------------------------------------------------

interface ExportFooterProps {
    roomId: string;
    tasks: TaskData[];
    nodeContents: Record<string, string>;
}

type ExportFormat = 'md' | 'pdf';

function ExportFooter({ roomId, tasks, nodeContents }: ExportFooterProps) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<ExportFormat | null>(null);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Snapshot the tasks-with-content payload we'd send. Memoized so we don't
    // rebuild the array on every render.
    const payloadTasks = useMemo(
        () =>
            tasks
                .map((t) => ({
                    content: (nodeContents[t.nodeId] ?? '').trim(),
                    authorName: t.authorName,
                    status: t.status,
                    createdAt: t.createdAt,
                }))
                .filter((t) => t.content.length > 0),
        [tasks, nodeContents],
    );

    const disabled = payloadTasks.length === 0 || busy !== null;

    // Click-outside to close the popover.
    useEffect(() => {
        if (!open) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [open]);

    async function handleExport(format: ExportFormat) {
        if (busy) return;
        setBusy(format);
        setError(null);
        try {
            const { markdown } = await api.summarizeTasks({
                tasks: payloadTasks,
                roomName: roomId,
            });

            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const baseName = `ligma-summary-${roomId}-${stamp}`;

            if (format === 'md') {
                downloadBlob(
                    new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
                    `${baseName}.md`,
                );
            } else {
                const pdf = renderMarkdownToPdf(markdown);
                pdf.save(`${baseName}.pdf`);
            }
            setOpen(false);
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.message || 'Export failed'
                    : err instanceof Error
                        ? err.message
                        : 'Export failed';
            setError(msg);
        } finally {
            setBusy(null);
        }
    }

    return (
        <div
            ref={containerRef}
            className="relative border-t px-2 py-2"
            style={{
                borderColor: 'rgba(190,148,96,0.16)',
                background: 'rgba(11,9,6,0.85)',
            }}
        >
            <button
                type="button"
                onClick={() => {
                    if (disabled && !busy) return;
                    setOpen((v) => !v);
                }}
                disabled={disabled}
                title={
                    payloadTasks.length === 0
                        ? 'Add an action item to enable AI summary export'
                        : 'Export an AI-generated summary of this board'
                }
                className="flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                    borderColor: 'rgba(190,148,96,0.3)',
                    background: open
                        ? 'rgba(190,148,96,0.18)'
                        : 'rgba(190,148,96,0.08)',
                    color: '#ede4d0',
                }}
                onMouseEnter={(e) => {
                    if (!disabled) e.currentTarget.style.background = 'rgba(190,148,96,0.18)';
                }}
                onMouseLeave={(e) => {
                    if (!open) e.currentTarget.style.background = 'rgba(190,148,96,0.08)';
                }}
            >
                {busy ? (
                    <Loader2 size={13} className="animate-spin" />
                ) : (
                    <Sparkles size={13} style={{ color: 'rgba(190,148,96,0.95)' }} />
                )}
                <span>{busy ? 'Generating summary…' : 'AI Summary Export'}</span>
                {!busy && <Download size={12} style={{ opacity: 0.7 }} />}
            </button>

            {error && (
                <p
                    className="mt-1.5 text-[10.5px] leading-snug"
                    style={{ color: 'rgba(248,113,113,0.85)' }}
                >
                    {error}
                </p>
            )}

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.16, ease: EASE }}
                        className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-lg border shadow-2xl"
                        style={{
                            borderColor: 'rgba(190,148,96,0.28)',
                            background: 'rgba(20,15,10,0.98)',
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        <div
                            className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                                color: 'rgba(190,148,96,0.7)',
                                borderBottom: '1px solid rgba(190,148,96,0.14)',
                            }}
                        >
                            Choose format
                        </div>
                        <ExportOption
                            icon={<FileText size={14} />}
                            label="Markdown (.md)"
                            description="Plain-text, editor-friendly"
                            disabled={busy !== null}
                            loading={busy === 'md'}
                            onClick={() => handleExport('md')}
                        />
                        <ExportOption
                            icon={<FileDown size={14} />}
                            label="PDF (.pdf)"
                            description="Formatted, printable document"
                            disabled={busy !== null}
                            loading={busy === 'pdf'}
                            onClick={() => handleExport('pdf')}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ExportOption({
    icon,
    label,
    description,
    disabled,
    loading,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    disabled: boolean;
    loading: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: '#ede4d0' }}
            onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.background = 'rgba(190,148,96,0.12)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            <span
                className="flex h-7 w-7 flex-none items-center justify-center rounded-md"
                style={{
                    background: 'rgba(190,148,96,0.14)',
                    color: 'rgba(190,148,96,0.95)',
                }}
            >
                {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium" style={{ color: '#ede4d0' }}>
                    {label}
                </p>
                <p
                    className="text-[10.5px] leading-tight"
                    style={{ color: 'rgba(237,228,208,0.5)' }}
                >
                    {description}
                </p>
            </div>
        </button>
    );
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke on next tick so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Render a Markdown string to a styled PDF document. We do not pull in a
 * full Markdown parser — Groq emits a predictable subset (#/##/### headings,
 * `- ` bullets, `*italic*`, `**bold**`, paragraphs) which we handle with a
 * light hand-rolled formatter that covers what `summarizeTasks` actually
 * produces.
 */
function renderMarkdownToPdf(markdown: string): jsPDF {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 56;
    const marginY = 64;
    const maxWidth = pageWidth - marginX * 2;
    let y = marginY;

    function ensureSpace(lineHeight: number) {
        if (y + lineHeight > pageHeight - marginY) {
            doc.addPage();
            y = marginY;
        }
    }

    function writeWrapped(
        text: string,
        opts: { size: number; style: 'normal' | 'bold' | 'italic'; indent?: number; gap?: number },
    ) {
        doc.setFont('helvetica', opts.style);
        doc.setFontSize(opts.size);
        const indent = opts.indent ?? 0;
        const lineHeight = opts.size * 1.35;
        const lines = doc.splitTextToSize(text, maxWidth - indent) as string[];
        for (const line of lines) {
            ensureSpace(lineHeight);
            doc.text(line, marginX + indent, y);
            y += lineHeight;
        }
        if (opts.gap) y += opts.gap;
    }

    // Strip simple inline emphasis for PDF rendering — jsPDF can't mix styles
    // mid-line without painful x-tracking, so we drop the markers but keep
    // the words.
    function stripInline(s: string): string {
        return s
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            .replace(/`([^`]+)`/g, '$1');
    }

    const rawLines = markdown.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i] ?? '';
        const trimmed = line.trim();

        if (trimmed.length === 0) {
            y += 6;
            continue;
        }

        if (trimmed.startsWith('# ')) {
            writeWrapped(stripInline(trimmed.slice(2).trim()), {
                size: 22,
                style: 'bold',
                gap: 8,
            });
            continue;
        }
        if (trimmed.startsWith('## ')) {
            writeWrapped(stripInline(trimmed.slice(3).trim()), {
                size: 16,
                style: 'bold',
                gap: 4,
            });
            continue;
        }
        if (trimmed.startsWith('### ')) {
            writeWrapped(stripInline(trimmed.slice(4).trim()), {
                size: 13,
                style: 'bold',
                gap: 2,
            });
            continue;
        }
        if (/^[-*]\s+/.test(trimmed)) {
            const text = stripInline(trimmed.replace(/^[-*]\s+/, ''));
            // Render bullet glyph at the indent boundary, then the text.
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            const lineHeight = 11 * 1.4;
            ensureSpace(lineHeight);
            doc.text('•', marginX + 4, y);
            const lines = doc.splitTextToSize(text, maxWidth - 18) as string[];
            for (let k = 0; k < lines.length; k++) {
                if (k > 0) ensureSpace(lineHeight);
                doc.text(lines[k]!, marginX + 18, y);
                y += lineHeight;
            }
            continue;
        }

        writeWrapped(stripInline(trimmed), {
            size: 11,
            style: 'normal',
            gap: 2,
        });
    }

    // Footer on the last page noting provenance.
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120);
    const footer = `Generated by Ligma · AI Summary Export · ${new Date().toLocaleString()}`;
    doc.text(footer, marginX, pageHeight - 28);
    doc.setTextColor(0);

    return doc;
}
