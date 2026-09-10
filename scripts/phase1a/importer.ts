import { compareRows, validateTarget } from './reconcile';
import { canonical, TABLE_ORDER, MAPPING_VERSION, type Mapped } from './mapping';
import { hash, schemaHash, type DB, type Row } from './db';
export type Provenance={ sourceSha:string; nativeVersion:string; inputSha:string };
export async function importMapped(db:DB, mapped:Mapped, provenance:Provenance, validate:(db:DB,mapped:Mapped)=>Promise<unknown>=validateTarget) {
  const schemaSha=await schemaHash();
  await db.exec('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await db.query('SELECT pg_advisory_xact_lock(20250907, 1)');
    // Prevent a concurrent write from being lost between validation and commit.
    await db.exec(`LOCK TABLE ${[...TABLE_ORDER,'profiles'].map(t=>'public.'+t).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    const authBefore=String((await db.query('SELECT count(*)::text AS n FROM auth.users')).rows[0].n);
    const run=(await db.query('SELECT source_sha256, mapping_version, schema_sha256, native_version, input_sha256 FROM car_show_private.import_runs WHERE source_key=$1',['qkby:2025'])).rows[0];
    const expected={source_sha256:provenance.sourceSha,mapping_version:MAPPING_VERSION,schema_sha256:schemaSha,native_version:provenance.nativeVersion,input_sha256:provenance.inputSha};
    if(run){
      if(canonical(run)!==canonical(expected)) throw new Error('Import provenance changed; reconciliation required');
      await compareRows(db,mapped);
    } else {
      for(const table of TABLE_ORDER){
        if((await db.query(`SELECT count(*)::text AS n FROM public.${table}`)).rows[0].n!=='0') throw new Error(`First import requires empty ${table}; refusing overwrite`);
      }
      for(const table of TABLE_ORDER){
        for(const row of mapped[table]){
          const keys=Object.keys(row);
          await db.query(`INSERT INTO public.${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
        }
      }
    }
    const report=await validate(db,mapped);
    const authAfter=String((await db.query('SELECT count(*)::text AS n FROM auth.users')).rows[0].n);
    if(authAfter!==authBefore) throw new Error('Auth user count changed during import');
    if(!run) await db.query(`INSERT INTO car_show_private.import_runs(source_key,source_sha256,mapping_version,schema_sha256,native_version,input_sha256) VALUES ('qkby:2025',$1,$2,$3,$4,$5)`,Object.values(expected));
    await db.exec('COMMIT');
    return {mode:run?'verified-no-op':'imported',auth_users_created:0,report};
  } catch(error) { await db.exec('ROLLBACK');throw error; }
}
export function inputHash(mapped:Mapped){
  return hash(canonical(Object.fromEntries(TABLE_ORDER.map(t=>[t,[...mapped[t]].sort((a:Row,b:Row)=>String(a.id).localeCompare(String(b.id)))]))));
}
