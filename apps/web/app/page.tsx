import Link from 'next/link';
import { env } from '@/lib/env';

export default function Home() {
  const demoRoom = env.defaultRoom;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-white p-8 dark:bg-neutral-950">
      <div className="space-y-3 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">LIGMA</h1>
        <p className="max-w-md text-neutral-600 dark:text-neutral-400">
          Real-time collaborative whiteboard that bridges ideation and execution.
        </p>
      </div>
      <Link
        href={`/room/${demoRoom}`}
        className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Open demo room →
      </Link>
      <p className="font-mono text-xs text-neutral-500">
        room id:{' '}
        <span className="text-neutral-700 dark:text-neutral-300">{demoRoom}</span>
      </p>
    </div>
  );
}
