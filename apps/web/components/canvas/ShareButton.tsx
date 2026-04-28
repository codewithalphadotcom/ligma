'use client';

/**
 * ShareButton — top-right floating pill that opens a themed modal showing
 * the live shareable room URL with a one-click copy control. Anyone who
 * opens the link lands on this page; cursors and shapes sync live for
 * everyone in the room (guest or signed in) over the Y.js WebSocket.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, X } from 'lucide-react';

export function ShareButton() {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [url, setUrl] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setUrl(window.location.href);
    }, []);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        window.addEventListener('keydown', onKey);
        const t = setTimeout(() => inputRef.current?.select(), 50);
        return () => {
            window.removeEventListener('keydown', onKey);
            clearTimeout(t);
        };
    }, [open]);

    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 1800);
        return () => clearTimeout(t);
    }, [copied]);

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                setCopied(true);
            } finally {
                document.body.removeChild(ta);
            }
        }
    }

    return (
        <>
            <button
                data-canvas-chrome="share-button"
                type="button"
                onClick={() => setOpen(true)}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all"
                style={{
                    background: '#ede4d0',
                    color: '#0b0906',
                    boxShadow: '0 8px 24px -8px rgba(0,0,0,0.5)',
                }}
            >
                <Link2 size={14} strokeWidth={2.5} />
                Share
            </button>

            {open && (
                <div
                    data-canvas-chrome="share-modal"
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setOpen(false);
                    }}
                    style={{ background: 'rgba(11,9,6,0.72)', backdropFilter: 'blur(8px)' }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Share this canvas"
                        className="relative w-full max-w-115 rounded-2xl px-7 py-7"
                        style={{
                            background: 'rgba(20,15,10,0.92)',
                            border: '1px solid rgba(190,148,96,0.18)',
                            backdropFilter: 'blur(36px)',
                            boxShadow:
                                '0 0 0 1px rgba(190,148,96,0.07), 0 32px 80px rgba(0,0,0,0.55)',
                            color: '#ede4d0',
                        }}
                    >
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setOpen(false)}
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[rgba(190,148,96,0.12)]"
                            style={{ color: 'rgba(237,228,208,0.7)' }}
                        >
                            <X size={16} />
                        </button>

                        <div
                            className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                            style={{ color: '#be9460' }}
                        >
                            <Link2 size={12} strokeWidth={2.5} />
                            Share canvas
                        </div>
                        <h2 className="text-[22px] font-semibold leading-tight">
                            Anyone with the link can join.
                        </h2>
                        <p
                            className="mt-2 text-[13.5px] leading-relaxed"
                            style={{ color: 'rgba(237,228,208,0.65)' }}
                        >
                            Cursors, shapes, and edits sync live for every visitor — no sign-in
                            required.
                        </p>

                        <div className="mt-5">
                            <label
                                htmlFor="share-url"
                                className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em]"
                                style={{ color: 'rgba(237,228,208,0.5)' }}
                            >
                                Live link
                            </label>
                            <div
                                className="flex items-center gap-1 rounded-lg p-1"
                                style={{
                                    background: 'rgba(11,9,6,0.55)',
                                    border: '1px solid rgba(190,148,96,0.16)',
                                }}
                            >
                                <input
                                    id="share-url"
                                    ref={inputRef}
                                    readOnly
                                    value={url}
                                    onFocus={(e) => e.currentTarget.select()}
                                    className="flex-1 bg-transparent px-3 py-2 font-mono text-[13px] outline-none"
                                    style={{ color: '#ede4d0' }}
                                />
                                <button
                                    type="button"
                                    onClick={copyLink}
                                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold transition-all"
                                    style={
                                        copied
                                            ? {
                                                background: 'rgba(70,170,110,0.18)',
                                                color: '#7ad79b',
                                                border: '1px solid rgba(70,170,110,0.4)',
                                            }
                                            : {
                                                background: '#ede4d0',
                                                color: '#0b0906',
                                            }
                                    }
                                >
                                    {copied ? (
                                        <>
                                            <Check size={13} strokeWidth={2.6} />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={13} strokeWidth={2.6} />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div
                            className="mt-5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px]"
                            style={{
                                background: 'rgba(190,148,96,0.08)',
                                border: '1px solid rgba(190,148,96,0.14)',
                                color: 'rgba(237,228,208,0.72)',
                            }}
                        >
                            <span
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{ background: '#7ad79b', boxShadow: '0 0 8px #7ad79b' }}
                            />
                            Live · synced over WebSocket
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
