import { WorkspaceClient } from '@/components/workspace/WorkspaceClient';
import { RoomHeader } from '@/components/workspace/RoomHeader';

interface RoomPageProps {
    params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
    const { roomId } = await params;
    return (
        <main className="flex h-screen w-screen flex-col">
            <RoomHeader roomId={roomId} />
            <WorkspaceClient roomId={roomId} />
        </main>
    );
}
