'use client';

/**
 * Visual decorations layered on top of every node component:
 *   - selection ring (A8)
 *   - lock icon for nodes the current user can't edit (A9)
 *   - inline ACL popover for Leads (C10)
 *
 * Rendered inside the world-transform container so the badge tracks the node
 * during pan/zoom, but the icon itself uses fixed stroke widths so it stays
 * legible at any zoom level.
 */

import { Lock, Check } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { aclLabel } from '@/lib/acl';
import type { NodeAcl } from '@/lib/types';

interface NodeChromeProps {
    acl: NodeAcl;
    canEdit: boolean;
    selected: boolean;
    commentCount: number;
    onCommentClick?: (e: React.MouseEvent) => void;
    /**
     * When provided, the lock badge becomes interactive and clicking it opens
     * a 3-option ACL popover. Only Leads should pass this in (callers gate
     * on `roomRole === 'lead'`). When omitted the badge is the original
     * read-only indicator.
     */
    onAclChange?: (next: NodeAcl) => void;
}

const ACL_OPTIONS: { value: NodeAcl; label: string; hint: string }[] = [
    { value: 'all', label: 'Open', hint: 'Everyone can edit' },
    { value: 'contributor+', label: 'Contributors+', hint: 'Lead & Contributors' },
    { value: 'lead-only', label: 'Lead-only', hint: 'Only the Lead' },
];

/**
 * Overlay chrome that all node renderers wrap themselves in. Pointer-events
 * are scoped to interactive children — the chrome itself doesn't intercept
 * drags. The lock badge becomes an interactive popover trigger when
 * `onAclChange` is supplied.
 */
function NodeChromeImpl({
    acl,
    canEdit,
    selected,
    commentCount,
    onCommentClick,
    onAclChange,
}: NodeChromeProps) {
    // Only Leads ever see the lock badge. Non-leads (Contributors / Viewers)
    // never see ACL chrome — read-only enforcement happens via `canEdit`,
    // which is gated by the same ACL upstream.
    const showLock = !!onAclChange;
    const [aclOpen, setAclOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    // Close popover on outside click / Escape.
    useEffect(() => {
        if (!aclOpen) return;
        function onDown(e: MouseEvent) {
            if (!popoverRef.current?.contains(e.target as Node)) setAclOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setAclOpen(false);
        }
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [aclOpen]);

    const interactiveLock = !!onAclChange;
    const lockBg = acl === 'all'
        ? 'bg-neutral-400'
        : canEdit
            ? 'bg-amber-500'
            : 'bg-neutral-700';

    return (
        <>
            {selected && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-blue-500"
                />
            )}
            {showLock && (
                <div className="absolute -left-2 -top-2">
                    {interactiveLock ? (
                        <button
                            type="button"
                            aria-label={`Change access (currently ${aclLabel(acl)})`}
                            title={`Edit access: ${aclLabel(acl)} — click to change`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                setAclOpen((o) => !o);
                            }}
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-white shadow ring-1 ring-black/10 hover:brightness-110 ${lockBg}`}
                        >
                            <Lock size={12} strokeWidth={2.5} />
                        </button>
                    ) : (
                        <div
                            aria-label={`Lock: ${aclLabel(acl)}`}
                            title={`Edit access: ${aclLabel(acl)}`}
                            className={`pointer-events-none flex h-6 w-6 items-center justify-center rounded-full text-white shadow ${lockBg}`}
                        >
                            <Lock size={12} strokeWidth={2.5} />
                        </div>
                    )}
                    {aclOpen && onAclChange && (
                        <div
                            ref={popoverRef}
                            role="menu"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 top-7 z-50 w-44 rounded-md border border-neutral-200 bg-white p-1 text-[12px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                        >
                            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                Edit access
                            </div>
                            {ACL_OPTIONS.map((opt) => {
                                const active = opt.value === acl;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={active}
                                        onClick={() => {
                                            if (!active) onAclChange(opt.value);
                                            setAclOpen(false);
                                        }}
                                        className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                    >
                                        <span className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
                                            {active && <Check size={12} strokeWidth={3} />}
                                        </span>
                                        <span className="flex flex-col">
                                            <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                                {opt.label}
                                            </span>
                                            <span className="text-[10px] text-neutral-500">
                                                {opt.hint}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            {/*
             * Comment badge intentionally removed — the popover component
             * (CommentPopover) was never mounted in the canvas tree, so the
             * button looked clickable but did nothing. Re-enable by
             * rendering <CommentPopover> in Canvas.tsx and restoring the
             * button below.
             */}
        </>
    );
}

export const NodeChrome = memo(NodeChromeImpl);
