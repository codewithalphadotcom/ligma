'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RoomHeaderProps {
  roomId: string;
}

export function RoomHeader({ roomId }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    // Listen for y-websocket provider status via custom events dispatched by yjs.ts
    function onConnect() { setWsStatus('connected'); }
    function onDisconnect() { setWsStatus('disconnected'); }
    window.addEventListener('ligma:ws-connected', onConnect);
    window.addEventListener('ligma:ws-disconnected', onDisconnect);
    return () => {
      window.removeEventListener('ligma:ws-connected', onConnect);
      window.removeEventListener('ligma:ws-disconnected', onDisconnect);
    };
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const statusDot =
    wsStatus === 'connected'
      ? 'bg-green-500'
      : wsStatus === 'connecting'
      ? 'bg-yellow-400 animate-pulse'
      : 'bg-red-500';

  return (
    <header className="flex flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight hover:opacity-70">
          LIGMA
        </Link>
        <span className="text-xs text-neutral-500">/ room</span>
        <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {roomId.slice(0, 8)}…
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          <span className="text-xs text-neutral-500 capitalize">{wsStatus}</span>
        </div>
        <button
          onClick={copyLink}
          className="rounded-md border border-neutral-200 px-3 py-1 text-xs font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </header>
  );
}
