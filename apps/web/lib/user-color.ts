/**
 * Deterministic, vibrant cursor / presence colour from a stable user id.
 *
 * Uses HSL with a fixed saturation/lightness band so colours are visually
 * distinct without ever being illegibly pale or muddy.
 */

const PALETTE = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
    '#6366f1', // indigo-500
] as const;

export function userColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = (hash * 31 + userId.charCodeAt(i)) | 0;
    }
    return PALETTE[Math.abs(hash) % PALETTE.length]!;
}
