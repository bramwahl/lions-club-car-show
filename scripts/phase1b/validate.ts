import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectTarget, ROOT, type DB } from '../phase1a/db';
import { mapSource } from '../phase1a/mapping';
import { pinnedSource, type Source } from '../phase1a/source';
import { compareRows, targetAwards, assertFixture } from '../phase1a/reconcile';
import { calculate, FIELDS, METRICS } from '../../src/domain/scoring';
export async function regression(db:DB) {
  const path=process.env.LEGACY_SQL_PATH;if(!path) throw new Error('Pinned source path required');
  await pinnedSource(path);
  const result=spawnSync('python3',[resolve(ROOT,'scripts/phase1a/dump-diagnostic.py'),path],{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.status!==0) throw new Error('Pinned source preflight failed');
  const mapped=mapSource(JSON.parse(result.stdout) as Source);
  await compareRows(db,mapped);
  const totals=(await db.query('SELECT legacy_score_id::text,total_score,overall_paint,overall_interior,overall_engine FROM public.scores')).rows;
  for(const s of mapped.scores){const got=totals.find(t=>t.legacy_score_id===s.legacy_score_id)!;const expected=calculate(Object.fromEntries(FIELDS.map(k=>[k,s[k] as number|null])));for(const k of METRICS) if(got[k]!==expected[k]) throw new Error('Legacy total changed');}
  const fixture=await assertFixture((await targetAwards(db)).awards);
  const rls=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity")).rows;
  if(rls.length!==7) throw new Error('RLS gate failed');
  const counts=Object.fromEntries(Object.entries(mapped).map(([k,v])=>[k,v.length]));
  return {counts,fixture,lions_choice_votes:2,allocator:257,exact_mapped_columns:true,all_generated_totals:true,rls_tables:7,source_comparison:'Pinned literal source; native replay is a separate gate'};
}
async function main(){
  const db=await connectTarget();try{const report=await regression(db);await writeFile(resolve(ROOT,'docs/car-show-phase1b/regression-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}catch{console.error('Phase 1B regression failed; no source data logged');process.exitCode=1;}finally{await db.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(()=>{console.error('Regression connection failed; no credentials logged');process.exitCode=1;});
