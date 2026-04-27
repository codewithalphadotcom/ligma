import pg from 'pg';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params as pg.QueryConfigValues<unknown[]>);

export async function runMigrations(): Promise<void> {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
}
