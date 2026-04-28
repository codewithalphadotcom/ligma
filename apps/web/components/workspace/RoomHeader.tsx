'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetRoomRole } from '@/lib/identity';
import type { RoomRole } from '@/lib/types';

interface RoomHeaderProps {
  roomId: string;
}

interface RoomMember {
  id: string;
  name: string;
  email: string;
  color: string;
  role: RoomRole;
}

export function RoomHeader({ roomId }: RoomHeaderProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfRole, setSelfRole] = useState<RoomRole | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const setLocalRole = useSetRoomRole();

  useEffect(() => {
    function onConnect() { setWsStatus('connected'); }
    function onDisconnect() { setWsStatus('disconnected'); }
    function onConnecting() { setWsStatus('connecting'); }
    window.addEventListener('ligma:ws-connected', onConnect);
    window.addEventListener('ligma:ws-disconnected', onDisconnect);
    window.addEventListener('ligma:ws-connecting', onConnecting);
    return () => {
      window.removeEventListener('ligma:ws-connected', onConnect);
      window.removeEventListener('ligma:ws-disconnected', onDisconnect);
      window.removeEventListener('ligma:ws-connecting', onConnecting);
    };
  }, []);

  const refreshMembers = useCallback(async () => {
    try {
      // Ensure caller is a member before reading the list — handles the
      // share-link join flow where the user has only just opened the URL.
      await api.joinRoom(roomId).catch(() => {/* getRoom error path will surface */ });
      const data = await api.getRoom(roomId);
      setMembers(data.members);
      const myId = session?.user?.id ?? null;
      setSelfId(myId);
      const me = data.members.find((m) => m.id === myId);
      if (me) {
        setSelfRole(me.role);
        // Mirror server-authoritative role into the local store so the canvas
        // ACL gating uses the correct value.
        setLocalRole(me.role);
      }
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to load members');
    }
  }, [roomId, setLocalRole, session?.user?.id]);

  // Initial fetch + refresh after auto-join settles.
  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function changeRole(userId: string, role: RoomRole) {
    setBusyUserId(userId);
    setPanelError('');
    try {
      await api.setMemberRole(roomId, userId, role);
      await refreshMembers();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setBusyUserId(null);
    }
  }

  const statusDot =
    wsStatus === 'connected'
      ? 'bg-green-500'
      : wsStatus === 'connecting'
        ? 'bg-yellow-400 animate-pulse'
        : 'bg-red-500';

  const isLead = selfRole === 'lead';

  return (
    <header className="relative flex flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight hover:opacity-70">
          LIGMA
        </Link>
        <span className="text-xs text-neutral-500">/ room</span>
        <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {roomId.slice(0, 8)}…
        </span>
        {selfRole && (
          <span className="rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-white dark:text-neutral-900">
            {selfRole}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          <span className="text-xs text-neutral-500 capitalize">{wsStatus}</span>
        </div>
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1 text-xs font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <Users size={12} />
          Members ({members.length})
        </button>
        <button
          onClick={copyLink}
          className="rounded-md border border-neutral-200 px-3 py-1 text-xs font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {panelOpen && (
        <div className="absolute right-4 top-full z-40 mt-1 w-80 rounded-md border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Members</span>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Close members panel"
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X size={14} />
            </button>
          </div>
          {panelError && (
            <p className="mb-2 text-xs text-red-500">{panelError}</p>
          )}
          {members.length === 0 ? (
            <p className="text-xs text-neutral-500">No members yet.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => {
                const isSelf = m.id === selfId;
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded px-1 py-1.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="truncate text-neutral-900 dark:text-neutral-100">
                        {m.name}
                        {isSelf && (
                          <span className="ml-1 text-[10px] uppercase text-neutral-400">
                            you
                          </span>
                        )}
                      </span>
                    </div>
                    {isLead && !isSelf ? (
                      <select
                        value={m.role}
                        disabled={busyUserId === m.id}
                        onChange={(e) =>
                          changeRole(m.id, e.target.value as RoomRole)
                        }
                        className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                      >
                        <option value="lead">Lead</option>
                        <option value="contributor">Contributor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                        {m.role}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!isLead && (
            <p className="mt-2 text-[10px] text-neutral-500">
              Only the room Lead can change roles.
            </p>
          )}
        </div>
      )}
    </header>
  );
}
