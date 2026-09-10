import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import mariadb from 'mariadb';
import { FIELDS } from '../../src/domain/scoring';
import { ROOT, hash, type Row } from './db';

export type Source = { participants: Row[]; cars: Row[]; scores: Row[]; history: Row[]; judges: Row[] };
export const COLUMNS = {
  participants: ['id','name','email','phone','address','city','state','zip'],
  cars: ['id','participant_id','car_number','year','make','model','notes','classification','status','paid'],
  scores: ['id','car_id', ...FIELDS,'overall_paint','overall_interior','overall_engine','total_score','progress_percentage','lions_choice'],
  history: ['id','score_id','user_id','section_updated','timestamp','updated_at','car_id','section'],
  judges: ['ID','user_login'],
} as const;
const TABLES = { participants:'qkby_lionsclub_participants', cars:'qkby_lionsclub_cars', scores:'qkby_lionsclub_scores', history:'qkby_lionsclub_score_updates', judges:'qkby_users' } as const;
export async function pinnedSource(path: string) {
  const manifest = JSON.parse(await readFile(resolve(ROOT,'docs/car-show-phase0/source-manifest.json'),'utf8')) as { filename:string; bytes:number; sha256:string }[];
  const expected = manifest.find(r => r.filename === 'i8194968_noxz1.sql')!;
  const data = await readFile(path);
  if (data.length !== expected.bytes || hash(data) !== expected.sha256) throw new Error('Pinned source fingerprint differs');
  return expected.sha256;
}
export const nativeAwardQuery = `SELECT c.id, c.car_number, c.year, c.make, c.model,
  s.total_score, s.overall_paint, s.overall_interior, s.overall_engine,
  p.name AS participant_name, p.city AS participant_city
  FROM qkby_lionsclub_cars AS c
  JOIN qkby_lionsclub_scores AS s ON c.id = s.car_id
  JOIN qkby_lionsclub_participants AS p ON c.participant_id = p.id
  ORDER BY s.total_score DESC`;
export async function extractNative() {
  const uri = process.env.LEGACY_DB_URL;
  if (!uri) throw new Error('Missing LEGACY_DB_URL for the isolated MariaDB 10.11 reference restore');
  const url = new URL(uri);
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.pathname !== '/car_show_reference') throw new Error('Legacy reference must be isolated on localhost in car_show_reference');
  const connection = await mariadb.createConnection({ host:url.hostname, port:Number(url.port || 3306), user:decodeURIComponent(url.username), password:decodeURIComponent(url.password), database:'car_show_reference', socketPath:process.env.LEGACY_DB_SOCKET, bigIntAsNumber:false, decimalAsNumber:false, dateStrings:true });
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const version = String((await connection.query('SELECT VERSION() AS version'))[0].version);
    if (!/^10\.11\./.test(version)) throw new Error('Native oracle requires MariaDB 10.11');
    const result = {} as Source;
    for (const key of Object.keys(TABLES) as (keyof Source)[]) {
      // Only allowlisted columns: passwords, email/login secrets are never extracted.
      result[key] = (await connection.query(`SELECT ${COLUMNS[key].map(c => '`'+c+'`').join(',')} FROM ${TABLES[key]} ORDER BY ${key === 'judges' ? 'ID' : 'id'}`)).map((row:Row) => Object.fromEntries(Object.entries(row).map(([k,v]) => [k, v === null ? null : String(v)])));
    }
    const ordered = await connection.query(nativeAwardQuery);
    const repeat = await connection.query(nativeAwardQuery);
    if (ordered.map((r:Row) => String(r.id)).join(',') !== repeat.map((r:Row) => String(r.id)).join(',')) throw new Error('Native tied query order changed between executions; stop');
    const metadata = (await connection.query('SELECT @@sql_mode AS sql_mode, @@collation_connection AS collation, @@session.time_zone AS time_zone'))[0];
    metadata.explain = (await connection.query('EXPLAIN '+nativeAwardQuery)).map((r:Row)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='bigint'?v.toString():v])));
    await connection.query('ROLLBACK');
    return { source:result, version, metadata, ordered: ordered.map((r:Row) => Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v === 'bigint'?v.toString():v]))) };
  } finally { await connection.end(); }
}
export function phpReplay(ordered: Row[], pluginPath: string) {
  const result = spawnSync(process.env.PHP_BIN || 'php', [resolve(ROOT,'scripts/phase1a/native-oracle.php'),pluginPath], { input:JSON.stringify(ordered), encoding:'utf8', maxBuffer:4*1024*1024 });
  if (result.error || result.status !== 0) throw new Error('Native PHP oracle unavailable/failed; no import is authorized past this regression gate');
  return JSON.parse(result.stdout) as { php_version:string; score_scalar_type:string; null_vs_database_zero:number; awards:Row[] };
}
