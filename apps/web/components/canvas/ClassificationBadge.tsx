'use client';

/**
 * ClassificationBadge — pill that surfaces the AI intent classification
 * applied to a node's text content. Anchored top-right of the node body
 * so it's visible without colliding with NodeChrome (which lives at
 * top-left for ACL/comments).
 *
 * Why visible:
 *   The classification field has been quietly written to nodes for a
 *   while, but only the Task Board reflected it (and only for
 *   action-items). This badge gives users immediate feedback that the
 *   AI saw their text and what it thinks it is — closing the loop on
 *   the AI intent feature.
 */

import type { NodeClassification } from '@/lib/types';

interface Props {
    classification: NodeClassification | null | undefined;
}

const STYLES: Record<
    NonNullable<NodeClassification>,
    { label: string; bg: string; fg: string; border: string }
> = {
    'action-item': {
        label: 'action',
        bg: 'rgba(249,115,22,0.18)',
        fg: '#fdba74',
        border: 'rgba(249,115,22,0.4)',
    },
    decision: {
        label: 'decision',
        bg: 'rgba(16,185,129,0.18)',
        fg: '#6ee7b7',
        border: 'rgba(16,185,129,0.4)',
    },
    'open-question': {
        label: 'question',
        bg: 'rgba(59,130,246,0.18)',
        fg: '#93c5fd',
        border: 'rgba(59,130,246,0.4)',
    },
    reference: {
        label: 'ref',
        bg: 'rgba(168,85,247,0.18)',
        fg: '#d8b4fe',
        border: 'rgba(168,85,247,0.4)',
    },
};

export function ClassificationBadge({ classification }: Props) {
    if (!classification) return null;
    const s = STYLES[classification];
    if (!s) return null;
    return (
        <div
            className="pointer-events-none absolute z-10 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm"
            style={{
                // Sit just above the node's top edge, right edges flush.
                top: -22,
                right: 0,
                background: s.bg,
                color: s.fg,
                borderColor: s.border,
                backdropFilter: 'blur(2px)',
            }}
            title={`AI classified this as: ${classification}`}
        >
            {s.label}
        </div>
    );
}
