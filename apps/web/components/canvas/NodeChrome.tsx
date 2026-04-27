'use client';

/**
 * Visual decorations layered on top of every node component:
 *   - selection ring (A8)
 *   - lock icon for nodes the current user can't edit (A9)
 *
 * Rendered inside the world-transform container so the badge tracks the node
 * during pan/zoom, but the icon itself uses fixed stroke widths so it stays
 * legible at any zoom level.
 */

import { Lock, MessageCircle } from 'lucide-react';
import { memo } from 'react';
import { aclLabel } from '@/lib/acl';
import type { NodeAcl } from '@/lib/types';

interface NodeChromeProps {
    acl: NodeAcl;
    canEdit: boolean;
    selected: boolean;
    commentCount: number;
    onCommentClick?: (e: React.MouseEvent) => void;
}

/**
 * Overlay chrome that all node renderers wrap themselves in. Pointer-events
 * are scoped to interactive children (lock badge is non-interactive, the
 * comment indicator is). The chrome itself doesn't intercept drags.
 */
function NodeChromeImpl({
    acl,
    canEdit,
    selected,
    commentCount,
    onCommentClick,
}: NodeChromeProps) {
    const showLock = acl !== 'all';
    return (
        <>
            {selected && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-blue-500"
                />
            )}
            {showLock && (
                <div
                    aria-label={`Lock: ${aclLabel(acl)}`}
                    title={`Edit access: ${aclLabel(acl)}`}
                    className={
                        'pointer-events-none absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-white shadow ' +
                        (canEdit ? 'bg-amber-500' : 'bg-neutral-700')
                    }
                >
                    <Lock size={12} strokeWidth={2.5} />
                </div>
            )}
            {(commentCount > 0 || selected) && (
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onCommentClick?.(e);
                    }}
                    aria-label={`Comments (${commentCount})`}
                    className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full bg-white px-1.5 text-[10px] font-semibold text-neutral-900 shadow ring-1 ring-black/10 hover:bg-blue-50"
                >
                    <MessageCircle size={11} strokeWidth={2.5} />
                    {commentCount > 0 ? commentCount : ''}
                </button>
            )}
        </>
    );
}

export const NodeChrome = memo(NodeChromeImpl);
