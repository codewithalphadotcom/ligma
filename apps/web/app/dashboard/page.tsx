'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, clearAuth } from '@/lib/api';

const RECENT_KEY = 'ligma:recentRooms';

interface RecentRoom {
  id: string;
  name: string;
  visitedAt: number;
}

function getRecentRooms(): RecentRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentRoom[];
  } catch {
    return [];
  }
}

function saveRecentRoom(room: { id: string; name: string }): void {
  const rooms = getRecentRooms().filter((r) => r.id !== room.id);
  rooms.unshift({ ...room, visitedAt: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(rooms.slice(0, 10)));
}

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ligma:token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setUserName(localStorage.getItem('ligma:authorName') ?? 'User');
    setRecentRooms(getRecentRooms());
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) return;
    setError('');
    setCreating(true);
    try {
      const { room } = await api.createRoom(roomName.trim());
      saveRecentRoom(room);
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const id = joinId.trim();
    if (!id) return;
    router.push(`/room/${id}`);
  }

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <span className="text-lg font-semibold tracking-tight">LIGMA</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">{userName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-10 px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-4 font-semibold">Create a room</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                required
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {creating ? 'Creating…' : 'Create room'}
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h2 className="mb-4 font-semibold">Join a room</h2>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                required
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Paste room ID or URL"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <button
                type="submit"
                className="w-full rounded-md border border-neutral-200 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Join room →
              </button>
            </form>
          </div>
        </div>

        {recentRooms.length > 0 && (
          <div>
            <h2 className="mb-3 font-semibold">Recent rooms</h2>
            <div className="space-y-2">
              {recentRooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/room/${room.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                >
                  <span className="font-medium">{room.name}</span>
                  <span className="font-mono text-xs text-neutral-400">{room.id.slice(0, 8)}…</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
