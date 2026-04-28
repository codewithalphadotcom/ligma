'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useYRoom } from '@/components/canvas/useYRoom';
import { useClientIdentity } from '@/lib/identity';
import { useIntentPipeline } from '@/lib/useIntentPipeline';
import { TaskBoard } from '@/components/taskboard/TaskBoard';
import { EventLog } from '@/components/sidebar/EventLog';

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
          collapsed={taskCollapsed}
          onToggle={() => setTaskCollapsed((v) => !v)}
        />
      )}
    </div>
  );
}
