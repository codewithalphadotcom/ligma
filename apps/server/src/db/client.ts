import pg from 'pg';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params as pg.QueryConfigValues<unknown[]>);

export async function runMigrations(): Promise<void> {
  const schemaUrl = new URL('./schema.sql', import.meta.url);
  const sql = await Bun.file(schemaUrl).text();
  await pool.query(sql);
}
