'use client';

/**
 * ReplayNodeLayer — read-only renderer used while in time-travel mode.
 *
 * Mirrors CanvasNodeLayer but skips drag handlers, comments, ACL, and edit
 * affordances. The rendering must visually match live nodes so users
 * recognise what they're looking at.
 *
 * Lives inside the world-transform container, same as CanvasNodeLayer.
 */

import { memo } from 'react';
import type { NodeSnapshot } from '@/lib/types';

interface ReplayNodeLayerProps {
    nodes: NodeSnapshot[];
}

function buildPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    const first = points[0]!;
    let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
        const p = points[i]!;
        d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
    return d;
}

function StickyView({ node }: { node: NodeSnapshot }) {
    return (
        <div
            className="absolute select-none rounded-sm shadow-md"
            style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: node.w,
                height: node.h,
                backgroundColor: node.color,
            }}
        >
            <div className="h-full w-full overflow-hidden whitespace-pre-wrap break-words p-2 text-sm leading-snug text-neutral-900">
                {node.content}
            </div>
        </div>
    );
}

function ShapeView({ node }: { node: NodeSnapshot }) {
    const isCircle = node.type === 'circle';
    return (
        <div
            className="absolute select-none"
            style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: node.w,
                height: node.h,
                backgroundColor: node.color,
                borderRadius: isCircle ? '50%' : 4,
            }}
        >
            <div className="flex h-full w-full items-center justify-center whitespace-pre-wrap break-words px-2 text-center text-sm font-medium text-neutral-900">
                {node.content}
            </div>
        </div>
    );
}

function TextView({ node }: { node: NodeSnapshot }) {
    return (
        <div
            className="absolute select-none"
            style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: node.w,
                minHeight: node.h,
            }}
        >
            <div className="whitespace-pre-wrap break-words font-sans text-base leading-snug text-neutral-900">
                {node.content}
            </div>
        </div>
    );
}

function StrokeView({ node }: { node: NodeSnapshot }) {
    if (node.points.length === 0) return null;
    const d = buildPath(node.points);
    return (
        <svg
            className="pointer-events-none absolute left-0 top-0"
            style={{ overflow: 'visible' }}
            width={0}
            height={0}
        >
            <path
                d={d}
                fill="none"
                stroke={node.color}
                strokeWidth={node.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ReplayNodeLayerImpl({ nodes }: ReplayNodeLayerProps) {
    return (
        <>
            {nodes.map((n) => {
                switch (n.type) {
                    case 'sticky':
                        return <StickyView key={n.id} node={n} />;
                    case 'rect':
                    case 'circle':
                    case 'triangle':
                    case 'diamond':
                    case 'hexagon':
                    case 'pentagon':
                    case 'star':
                    case 'parallelogram':
                    case 'line':
                    case 'arrow':
                        return <ShapeView key={n.id} node={n} />;
                    case 'text':
                        return <TextView key={n.id} node={n} />;
                    case 'stroke':
                        return <StrokeView key={n.id} node={n} />;
                    default:
                        return null;
                }
            })}
        </>
    );
}

export const ReplayNodeLayer = memo(ReplayNodeLayerImpl);
