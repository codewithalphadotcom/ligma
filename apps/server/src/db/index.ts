import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

/**
 * Single shared postgres.js connection pool. `prepare: false` disables
 * prepared statements which is the recommended setting for Supabase's
 * pgbouncer (transaction pooling) — see drizzle-orm docs.
 */
export const sql = postgres(DATABASE_URL, {
    max: 10,
    prepare: false,
    onnotice: () => {
        /* swallow Postgres NOTICE chatter from idempotent migrations */
    },
});

export const db = drizzle(sql, { schema });

export type DB = typeof db;
export { schema };
