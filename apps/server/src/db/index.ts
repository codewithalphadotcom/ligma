import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const CONNECTION_URL = process.env.NEONDB_URL;
if (!CONNECTION_URL) {
    throw new Error('NEONDB_URL environment variable is required');
}

/**
 * Single shared postgres.js connection pool. `prepare: false` disables
 * prepared statements which is required for Neon's pgbouncer pooler
 * — see drizzle-orm docs.
 */
export const sql = postgres(CONNECTION_URL, {
    max: 10,
    prepare: false,
    onnotice: () => {
        /* swallow Postgres NOTICE chatter from idempotent migrations */
    },
});

export const db = drizzle(sql, { schema });

export type DB = typeof db;
export { schema };
