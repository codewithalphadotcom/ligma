import { WorkspaceClient } from '@/components/workspace/WorkspaceClient';

interface RoomPageProps {
    params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
    const { roomId } = await params;
    return (
        <main className="flex h-screen w-screen overflow-hidden bg-[#0b0906]">
            <WorkspaceClient roomId={roomId} />
        </main>
    );
}
