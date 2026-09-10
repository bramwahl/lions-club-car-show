import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectTarget, migrate, ROOT, hash } from './db';
import { pinnedSource, extractNative, phpReplay, type Source } from './source';
import { canonical, mapSource } from './mapping';
import { importMapped, inputHash } from './importer';
import { assertFixture, AwardMismatch, validateTarget } from './reconcile';

export async function prepareSource() {
  const path=process.env.LEGACY_SQL_PATH;
  const plugin=process.env.LEGACY_PLUGIN_PATH;
  const zip=process.env.LEGACY_ZIP_PATH;
  if(!path||!plugin||!zip) throw new Error('Set LEGACY_SQL_PATH, LEGACY_ZIP_PATH and LEGACY_PLUGIN_PATH to the pinned private inputs');
  const sourceSha=await pinnedSource(path);
  const manifest=JSON.parse(await readFile(resolve(ROOT,'docs/car-show-phase0/source-manifest.json'),'utf8')) as {filename:string;sha256:string}[];
  if(hash(await readFile(zip))!==manifest.find(f=>f.filename==='lions-club-car-show.zip')!.sha256) throw new Error('Plugin ZIP fingerprint differs');
  const original=spawnSync('python3',['-c','import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("lions-club-car-show/lions-club-car-show.php"))',zip],{maxBuffer:4*1024*1024});
  if(original.status!==0||hash(original.stdout)!==hash(await readFile(plugin))) throw new Error('Plugin source does not match pinned ZIP');
  const native=await extractNative();
  const diagnostic=spawnSync('python3',[resolve(ROOT,'scripts/phase1a/dump-diagnostic.py'),path],{encoding:'utf8',maxBuffer:8*1024*1024});
  if(diagnostic.status!==0) throw new Error('Pinned dump preflight failed');
  const literal=JSON.parse(diagnostic.stdout) as Source;
  for(const key of Object.keys(literal) as (keyof Source)[]){
    const sort=(rows:typeof literal[typeof key])=>[...rows].sort((a,b)=>String(a.id??a.ID).localeCompare(String(b.id??b.ID)));
    if(canonical(sort(literal[key]))!==canonical(sort(native.source[key]))) throw new Error(`Native restore differs from pinned input: ${key}`);
  }
  const replay=phpReplay(native.ordered,plugin);
  if(replay.score_scalar_type!=='string'||replay.null_vs_database_zero!==-1) throw new Error('Native PHP scalar contract differs; stop for review');
  await assertFixture(replay.awards,true);
  const mapped=mapSource(native.source);
  if(mapped.events[0].next_car_number!=='257') throw new Error('Imported allocator seed differs');
  return {mapped,provenance:{sourceSha,nativeVersion:`${native.version};PHP ${replay.php_version}`,inputSha:inputHash(mapped)},nativeMetadata:native.metadata};
}
async function main(){
  const command=process.argv[2];
  if(!['inspect','migrate','import','validate','source'].includes(command)) throw new Error('Usage: cli.ts inspect|migrate|source|import|validate');
  // Native source/PDF gate is checked BEFORE target import opens a connection.
  const source=['source','import','validate'].includes(command)?await prepareSource():null;
  if(command==='source'){console.log(JSON.stringify({native:source!.provenance.nativeVersion,metadata:source!.nativeMetadata,fixture_rows:51},null,2));return;}
  const db=await connectTarget();
  try{
    if(command==='inspect'){
      console.log(JSON.stringify((await db.query("SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname IN ('public','car_show_private') ORDER BY schemaname,tablename")).rows,null,2));
    }else if(command==='migrate') console.log(JSON.stringify({migrations:await migrate(db)},null,2));
    else if(command==='import') console.log(JSON.stringify(await importMapped(db,source!.mapped,source!.provenance),null,2));
    else console.log(JSON.stringify(await validateTarget(db,source!.mapped),null,2));
  }finally{await db.close();}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error=>{
  // Database driver errors can contain contacts/connection strings: never print them.
  if(error instanceof AwardMismatch) console.error(JSON.stringify({error:error.message,differences:error.differences},null,2));
  else if(error?.code) console.error(`Database/runtime operation failed (${String(error.code)}); no row values or credentials logged.`);
  else console.error(error instanceof Error?error.message:'Phase 1A failed');
  process.exitCode=1;
});
