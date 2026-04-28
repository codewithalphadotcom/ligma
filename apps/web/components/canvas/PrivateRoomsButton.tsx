'use client';

/**
 * PrivateRoomsButton — sits to the left of the Share button in the
 * top-right canvas chrome. Click behaviour:
 *   - Authenticated user → /dashboard
 *   - Anyone else        → /login (signup link is one click away there)
 *
 * The button is intentionally subtle (outlined, brass-tinted) so the
 * primary Share affordance stays the visual anchor.
 */

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Lock } from 'lucide-react';

export function PrivateRoomsButton() {
    const { status } = useSession();
    const href = status === 'authenticated' ? '/dashboard' : '/login';

    return (
        <Link
            data-canvas-chrome="private-rooms-button"
            href={href}
            prefetch={false}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-all"
            style={{
                background: 'rgba(20,15,10,0.78)',
                color: '#ede4d0',
                border: '1px solid rgba(190,148,96,0.28)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 8px 24px -10px rgba(0,0,0,0.5)',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(35,25,15,0.85)';
                e.currentTarget.style.borderColor = 'rgba(190,148,96,0.5)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(20,15,10,0.78)';
                e.currentTarget.style.borderColor = 'rgba(190,148,96,0.28)';
            }}
        >
            <Lock size={13} strokeWidth={2.4} />
            Private rooms
        </Link>
    );
}
