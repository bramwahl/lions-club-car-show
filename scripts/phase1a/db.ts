import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client, types } from 'pg';
export type Row = Record<string, unknown>;
export interface DB { query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; exec(sql: string): Promise<unknown> }
export const ROOT = resolve(import.meta.dirname, '../..');
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export async function migrationFiles() {
  const dir = resolve(ROOT, 'supabase/migrations');
  return Promise.all((await readdir(dir)).filter(n => /^\d+_.*\.sql$/.test(n)).sort().map(async name => ({ name, sql: await readFile(resolve(dir, name), 'utf8') })));
}
export async function schemaHash() { return hash((await migrationFiles()).map(f => `${f.name}\n${f.sql}`).join('\n')); }
export async function migrate(db: DB) {
  await db.exec('BEGIN');
  try {
    await db.query('SELECT pg_advisory_xact_lock(20250907, 1)');
    await db.exec(`CREATE SCHEMA IF NOT EXISTS car_show_private;
      REVOKE ALL ON SCHEMA car_show_private FROM public, anon, authenticated;
      CREATE TABLE IF NOT EXISTS car_show_private.schema_migrations (
        name text primary key, sha256 text not null, applied_at timestamptz not null default now());
      REVOKE ALL ON car_show_private.schema_migrations FROM public, anon, authenticated;`);
    const applied = (await db.query('SELECT name, sha256 FROM car_show_private.schema_migrations ORDER BY name')).rows;
    const files = await migrationFiles();
    if (applied.some((r, i) => r.name !== files[i]?.name || r.sha256 !== hash(files[i].sql))) throw new Error('Migration history differs; refusing schema mutation');
    for (const file of files.slice(applied.length)) {
      await db.exec(file.sql);
      await db.query('INSERT INTO car_show_private.schema_migrations(name, sha256) VALUES ($1,$2)', [file.name, hash(file.sql)]);
    }
    await db.exec('COMMIT');
    return files.map(f => f.name);
  } catch (error) { await db.exec('ROLLBACK'); throw error; }
}
export async function connectTarget(): Promise<DB & { close(): Promise<void> }> {
  // Never coerce bigint identities, decimals or historical wall-clock times to JS Number/Date.
  for (const oid of [20, 1700, 1114, 1184, 1082]) types.setTypeParser(oid, value => value);
  const uri = process.env.SUPABASE_DB_URL;
  if (!uri) throw new Error('Missing SUPABASE_DB_URL. See docs/car-show-phase1a/README.md.');
  const url = new URL(uri);
  const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0];
  const direct = url.hostname === `db.${project}.supabase.co`;
  const session = /^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && decodeURIComponent(url.username) === `postgres.${project}`;
  if ((!direct && !session) || (url.port && url.port !== '5432') || url.pathname !== '/postgres') throw new Error('Target does not match the configured Supabase project/direct or session endpoint');
  // Strip libpq SSL query switches so they cannot disable certificate verification.
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
  const ca = process.env.SUPABASE_DB_CA_FILE ? await readFile(process.env.SUPABASE_DB_CA_FILE, 'utf8') : undefined;
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, connectionTimeoutMillis: 15000, application_name: 'car-show-phase1a' });
  await client.connect();
  return { query: (sql, params) => client.query(sql, params), exec: sql => client.query(sql), close: () => client.end() };
}
