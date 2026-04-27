/**
 * Centralised, typed access to public env vars.
 * Only NEXT_PUBLIC_* vars are exposed to the browser.
 */

function readPublic(key: `NEXT_PUBLIC_${string}`, fallback: string): string {
    const v = process.env[key];
    return v && v.length > 0 ? v : fallback;
}

export const env = {
    apiUrl: readPublic('NEXT_PUBLIC_API_URL', 'http://localhost:8080'),
    wsUrl: readPublic('NEXT_PUBLIC_WS_URL', 'ws://localhost:8080'),
    defaultRoom: readPublic('NEXT_PUBLIC_DEFAULT_ROOM', 'demo'),
} as const;
