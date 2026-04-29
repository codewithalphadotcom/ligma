import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dnsMod from 'node:dns';
import * as net from 'node:net';
import * as schema from './schema.js';

const CONNECTION_URL = process.env.NEONDB_URL;
if (!CONNECTION_URL) {
    throw new Error('NEONDB_URL environment variable is required');
}

// ---------------------------------------------------------------------------
// DNS health filter
// ---------------------------------------------------------------------------
//
// Neon's pooler hostname commonly resolves to multiple A records (different
// AWS edge IPs). On some networks one of those IPs is unreachable
// (ECONNREFUSED / EHOSTUNREACH), which produces an avalanche of unhandled
// connection errors when postgres.js or Bun's TCP layer happens to pick the
// dead IP from the round-robin set.
//
// To make connections resilient WITHOUT hardcoding an IP (which would break
// TLS SNI + certificate validation), we:
//   1. Resolve all A records for the DB hostname at boot.
//   2. TCP-probe each on :5432 with a short timeout.
//   3. Install a process-wide `dns.lookup` shim that, for THIS hostname only,
//      returns one of the probed-healthy IPs. Other lookups fall through to
//      the platform resolver untouched.
//
// The TLS handshake still uses the original hostname for SNI, so cert
// verification continues to work.
function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.connect(port, host);
    });
}

async function installHealthyDnsShim(connectionUrl: string): Promise<void> {
    let parsed: URL;
    try {
        parsed = new URL(connectionUrl);
    } catch {
        return; // Non-URL form (e.g. test placeholder) — nothing to do.
    }
    const hostname = parsed.hostname;
    const port = Number(parsed.port || '5432');
    if (!hostname || net.isIP(hostname)) return; // Already an IP literal.

    let addrs: dnsMod.LookupAddress[];
    try {
        addrs = await dnsMod.promises.lookup(hostname, { all: true, verbatim: true });
    } catch {
        return; // DNS itself is broken — let postgres.js produce the real error.
    }

    if (addrs.length <= 1) return; // No alternative to choose from.

    const results = await Promise.all(
        addrs.map(async (a) => ({ addr: a, ok: await probeTcp(a.address, port, 2500) })),
    );
    const healthy = results.filter((r) => r.ok).map((r) => r.addr);

    // If everything is down OR every candidate is up, leave the default
    // resolver alone — there's nothing useful to filter.
    if (healthy.length === 0 || healthy.length === addrs.length) return;

    const dead = results.filter((r) => !r.ok).map((r) => r.addr.address);
    console.warn(
        `[db] DNS health filter: ${dead.length}/${addrs.length} IPs for ${hostname} unreachable on :${port} (${dead.join(', ')}). Pinning to healthy: ${healthy.map((a) => a.address).join(', ')}`,
    );

    let rr = 0;
    // Grab the mutable CJS dns module — ESM `node:dns` exports are frozen
    // under Bun, so we can't assign to `dnsMod.lookup` directly. The CJS
    // `require('dns')` returns the same underlying module object that the
    // platform net layer reads from, and its `lookup` property IS writable.
    const { createRequire } = await import('node:module');
    const requireFn = createRequire(import.meta.url);
    const dnsCjs = requireFn('dns') as typeof dnsMod;
    const originalLookup = dnsCjs.lookup.bind(dnsCjs) as typeof dnsMod.lookup;

    // Replace the exported lookup with a shim. postgres.js / Node's net layer
    // call `dns.lookup` (NOT `dns.resolve4`), so this is the right hook.
    type LookupCb = (
        err: NodeJS.ErrnoException | null,
        address: string,
        family: number,
    ) => void;
    type LookupAllCb = (
        err: NodeJS.ErrnoException | null,
        addresses: dnsMod.LookupAddress[],
    ) => void;

    function shim(
        host: string,
        optionsOrCb: dnsMod.LookupOptions | LookupCb,
        maybeCb?: LookupCb | LookupAllCb,
    ): void {
        const isOptionsObject =
            optionsOrCb !== null && typeof optionsOrCb === 'object';
        const options: dnsMod.LookupOptions = isOptionsObject ? optionsOrCb : {};
        const cb = (isOptionsObject ? maybeCb : optionsOrCb) as
            | LookupCb
            | LookupAllCb
            | undefined;

        if (host !== hostname || typeof cb !== 'function') {
            // Delegate everything else to the real resolver.
            return (originalLookup as unknown as (...args: unknown[]) => void)(
                ...(arguments as unknown as unknown[]),
            );
        }

        const pick = healthy[rr++ % healthy.length]!;
        if (options.all) {
            (cb as LookupAllCb)(null, [pick]);
        } else {
            (cb as LookupCb)(null, pick.address, pick.family);
        }
    }

    try {
        Object.defineProperty(dnsCjs, 'lookup', {
            value: shim,
            writable: true,
            configurable: true,
        });
    } catch {
        // If even the CJS dns is locked down, give up silently — postgres.js
        // will still see the round-robin DNS and may pick a bad IP, but the
        // unhandled-rejection guard in index.ts keeps the log noise bounded.
    }
}

// Top-level await is supported in Bun ESM. We block module init briefly so
// the postgres pool below sees the patched resolver from its very first
// connection attempt.
await installHealthyDnsShim(CONNECTION_URL);

/**
 * Single shared postgres.js connection pool. `prepare: false` disables
 * prepared statements which is required for Neon's pgbouncer pooler
 * — see drizzle-orm docs.
 */
export const sql = postgres(CONNECTION_URL, {
    max: 10,
    prepare: false,
    // Fail fast on bad endpoints so the lib can move on to the next pool
    // slot rather than hanging the request.
    connect_timeout: 10,
    onnotice: () => {
        /* swallow Postgres NOTICE chatter from idempotent migrations */
    },
});

export const db = drizzle(sql, { schema });

export type DB = typeof db;
export { schema };

