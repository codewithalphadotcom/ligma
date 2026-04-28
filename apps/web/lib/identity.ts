'use client';

/**
 * Client identity hook.
 *
 * For authenticated users: identity (id, display name, color) comes from
 * the NextAuth session; the session token also holds the Express-issued JWT
 * used for WebSocket auth.
 *
 * For unauthenticated visitors (public-canvas / share-link flow): a stable
 * pseudo-identity is generated and persisted in localStorage. Display names
 * default to "Guest 1234" but the user can override them later. The same id
 * is reused across reloads so awareness colours and authorship stay stable.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { userColor } from './user-color';
import type { RoomRole } from './types';

const ROLE_KEY = 'ligma:roomRole';
const GUEST_ID_KEY = 'ligma:guestId';
const GUEST_NAME_KEY = 'ligma:guestName';

function readStoredRole(): RoomRole {
    if (typeof window === 'undefined') return 'lead';
    const raw = window.localStorage.getItem(ROLE_KEY);
    if (raw === 'lead' || raw === 'contributor' || raw === 'viewer') return raw;
    return 'lead';
}

function readGuestIdentity(): { id: string; name: string } {
    let id = window.localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
        id = `guest_${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem(GUEST_ID_KEY, id);
    }
    let name = window.localStorage.getItem(GUEST_NAME_KEY);
    if (!name) {
        name = `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
        window.localStorage.setItem(GUEST_NAME_KEY, name);
    }
    return { id, name };
}

export interface ClientIdentity {
    authorId: string;
    authorName: string;
    color: string;
    roomRole: RoomRole;
}

export function useClientIdentity(): ClientIdentity | null {
    const { data: session, status } = useSession();
    const [roomRole, setRoomRoleState] = useState<RoomRole>('lead');
    const [guest, setGuest] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        setRoomRoleState(readStoredRole());
        setGuest(readGuestIdentity());
        function onStorage(e: StorageEvent) {
            if (e.key === ROLE_KEY) setRoomRoleState(readStoredRole());
            if (e.key === GUEST_NAME_KEY || e.key === GUEST_ID_KEY) {
                setGuest(readGuestIdentity());
            }
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    if (status === 'loading') return null;

    if (status === 'authenticated' && session?.user?.id) {
        return {
            authorId: session.user.id,
            authorName: session.user.name ?? 'User',
            color: session.user.color ?? '#737373',
            roomRole,
        };
    }

    if (!guest) return null;
    return {
        authorId: guest.id,
        authorName: guest.name,
        color: userColor(guest.id),
        roomRole: 'contributor',
    };
}

/**
 * Returns a stable setter that updates the persisted room role and
 * synchronously refreshes the identity hook in the current tab.
 */
export function useSetRoomRole(): (role: RoomRole) => void {
    return useCallback((role: RoomRole) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(ROLE_KEY, role);
        // Native `storage` events only fire in *other* tabs, so we manually
        // dispatch one for the current tab.
        window.dispatchEvent(
            new StorageEvent('storage', { key: ROLE_KEY, newValue: role }),
        );
    }, []);
}

