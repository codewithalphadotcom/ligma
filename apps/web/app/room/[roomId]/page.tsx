import { CanvasRootClient } from '@/components/canvas/CanvasRootClient';

interface RoomPageProps {
    params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
    const { roomId } = await params;
    return (
        <main className="flex h-screen w-screen flex-col">
            <header className="flex items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold tracking-tight">LIGMA</span>
                    <span className="text-xs text-neutral-500">/ room</span>
                    <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        {roomId}
                    </span>
                </div>
            </header>
            <div className="relative flex-1">
                <CanvasRootClient roomId={roomId} />
            </div>
        </main>
    );
}
