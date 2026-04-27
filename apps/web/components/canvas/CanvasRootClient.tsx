'use client';

import dynamic from 'next/dynamic';

// Y.js touches WebSocket / window. Defer to client.
const CanvasRoot = dynamic(
    () => import('@/components/canvas/CanvasRoot').then((m) => m.CanvasRoot),
    { ssr: false },
);

export function CanvasRootClient({ roomId }: { roomId: string }) {
    return <CanvasRoot roomId={roomId} />;
}
