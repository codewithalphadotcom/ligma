/**
 * Centralised, typed access to public env vars.
 * Only NEXT_PUBLIC_* vars are exposed to the browser.
 *
 * Each var must be accessed via a static `process.env.NEXT_PUBLIC_*`
 * expression so Next.js can inline the value at build time. Dynamic
 * bracket access (process.env[key]) bypasses the static replacement
 * and always falls back to the default in the browser bundle.
 */
export const env = {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
    defaultRoom: process.env.NEXT_PUBLIC_DEFAULT_ROOM || 'demo',
} as const;
