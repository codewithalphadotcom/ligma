'use client';

/**
 * CursorLayer — A7 deliverable.
 *
 * Renders remote peers' cursors and name labels in **screen space** (so they
 * stay readable at any zoom). Cursor positions arrive in world coordinates
 * via Y.Awareness; we convert them through the local viewport.
 */

import { memo } from 'react';
import type { PresenceMap } from './useAwareness';
import type { Viewport } from '@/lib/types';

interface CursorLayerProps {
    presence: PresenceMap;
    viewport: Viewport;
}

function CursorLayerImpl({ presence, viewport }: CursorLayerProps) {
    const cursors: Array<{
        clientId: number;
        screenX: number;
        screenY: number;
        name: string;
        color: string;
    }> = [];

    presence.forEach((p, clientId) => {
        if (!p.cursor) return;
        cursors.push({
            clientId,
            screenX: p.cursor.x * viewport.zoom + viewport.x,
            screenY: p.cursor.y * viewport.zoom + viewport.y,
            name: p.user.name,
            color: p.user.color,
        });
    });

    if (cursors.length === 0) return null;

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {cursors.map((c) => (
                <div
                    key={c.clientId}
                    className="absolute"
                    style={{
                        transform: `translate3d(${c.screenX}px, ${c.screenY}px, 0)`,
                    }}
                >
                    {/* Arrow SVG. The 0,0 anchor is the tip of the cursor. */}
                    <svg
                        width={20}
                        height={22}
                        viewBox="0 0 20 22"
                        style={{ display: 'block' }}
                    >
                        <path
                            d="M2 2 L18 12 L11 13 L7 20 Z"
                            fill={c.color}
                            stroke="white"
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                        />
                    </svg>
                    <div
                        className="ml-3 -mt-0.5 inline-block max-w-40 truncate rounded-md px-1.5 py-0.5 text-xs font-medium text-white shadow"
                        style={{ backgroundColor: c.color }}
                    >
                        {c.name}
                    </div>
                </div>
            ))}
        </div>
    );
}

export const CursorLayer = memo(CursorLayerImpl);
