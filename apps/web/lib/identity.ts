'use client';

/**
 * Lightweight client identity for the hackathon demo.
 *
 * Generates and persists a stable `authorId` + display name + room role per
 * browser via localStorage. Replaced later by JWT-derived identity that the
 * server returns on signin (Teammate B/C).
 *
 * Room role defaults to `lead` so a single-tab demo can exercise every
 * feature; flip it via `setRoomRole()` (also exposed on `window.ligma` in
 * dev) to test ACL gating.
 */

import { useCallback, useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import type { RoomRole } from './types';

const ID_KEY = 'ligma:authorId';
const NAME_KEY = 'ligma:authorName';
const ROLE_KEY = 'ligma:roomRole';

const ADJECTIVES = ['Swift', 'Bright', 'Quiet', 'Wild', 'Brave', 'Sly', 'Bold', 'Calm'];
const ANIMALS = ['Otter', 'Falcon', 'Panda', 'Lynx', 'Heron', 'Wolf', 'Fox', 'Hawk'];

function randomName(): string {
    const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return `${a} ${b}`;
}

function readStoredRole(): RoomRole {
    if (typeof window === 'undefined') return 'lead';
    const raw = window.localStorage.getItem(ROLE_KEY);
    if (raw === 'lead' || raw === 'contributor' || raw === 'viewer') return raw;
    return 'lead';
}

export interface ClientIdentity {
    authorId: string;
    authorName: string;
    roomRole: RoomRole;
}

export function useClientIdentity(): ClientIdentity | null {
    const [identity, setIdentity] = useState<ClientIdentity | null>(null);

    useEffect(() => {
        let id = localStorage.getItem(ID_KEY);
        if (!id) {
            id = nanoid(12);
            localStorage.setItem(ID_KEY, id);
        }
        let name = localStorage.getItem(NAME_KEY);
        if (!name) {
            name = randomName();
            localStorage.setItem(NAME_KEY, name);
        }
        const roomRole = readStoredRole();
        setIdentity({ authorId: id, authorName: name, roomRole });

        // Cross-tab role sync: listen for storage events.
        function onStorage(e: StorageEvent) {
            if (e.key !== ROLE_KEY) return;
            setIdentity((prev) =>
                prev ? { ...prev, roomRole: readStoredRole() } : prev,
            );
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return identity;
}

/**
 * Returns a stable setter that updates the persisted room role and
 * synchronously refreshes the identity hook.
 */
export function useSetRoomRole(): (role: RoomRole) => void {
    return useCallback((role: RoomRole) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(ROLE_KEY, role);
        // Manually fire a storage-equivalent event for the current tab; the
        // native `storage` event only fires in *other* tabs.
        window.dispatchEvent(
            new StorageEvent('storage', { key: ROLE_KEY, newValue: role }),
        );
    }, []);
}

