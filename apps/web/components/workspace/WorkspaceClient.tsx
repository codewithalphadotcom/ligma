'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useYRoom } from '@/components/canvas/useYRoom';
import { useClientIdentity } from '@/lib/identity';
import { useIntentPipeline } from '@/lib/useIntentPipeline';
import { TaskBoard } from '@/components/taskboard/TaskBoard';
import { EventLog } from '@/components/sidebar/EventLog';
import { api } from '@/lib/api';

const CanvasRootClient = dynamic(
  () => import('@/components/canvas/CanvasRootClient').then((m) => m.CanvasRootClient),
  { ssr: false },
);

interface WorkspaceClientProps {
  roomId: string;
}

export function WorkspaceClient({ roomId }: WorkspaceClientProps) {
  const room = useYRoom(roomId);
  const identity = useClientIdentity();
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [taskCollapsed, setTaskCollapsed] = useState(false);
  const [roomName, setRoomName] = useState<string | undefined>(undefined);

  // Fetch the human-friendly room name (assigned by the host on creation) so
  // the AI Summary export can use it as the document heading instead of the
  // raw room UUID. Failures are silent — the export simply falls back to the
  // id-less default heading.
  useEffect(() => {
    let cancelled = false;
    api
      .getRoom(roomId)
      .then((res) => {
        if (!cancelled) setRoomName(res.room.name);
      })
      .catch(() => { /* user may be a guest with no read access; ignore */ });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useIntentPipeline(
    room,
    identity?.authorId ?? '',
    identity?.authorName ?? 'Unknown',
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {room && (
        <EventLog
          room={room}
          collapsed={logCollapsed}
          onToggle={() => setLogCollapsed((v) => !v)}
        />
      )}

      <div className="relative flex-1 overflow-hidden">
        <CanvasRootClient roomId={roomId} />
      </div>

      {room && (
        <TaskBoard
          room={room}
          roomName={roomName}
          collapsed={taskCollapsed}
          onToggle={() => setTaskCollapsed((v) => !v)}
        />
      )}
    </div>
  );
}
