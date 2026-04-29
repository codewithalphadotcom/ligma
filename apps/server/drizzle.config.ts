/// <reference types="bun" />
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from 'drizzle-kit';

// drizzle-kit doesn't auto-load `.env.local`; load it ourselves so a
// single source of truth (the env file) feeds both `bun run dev` and
// `bun run db:push`.
function loadEnvFile(path: string) {
    if (!existsSync(path)) return;
    const raw = readFileSync(path, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
    }
}

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env'));

const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error('DATABASE_URL environment variable is required for drizzle-kit');
}

export default {
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url },
    strict: true,
    verbose: true,
} satisfies Config;

