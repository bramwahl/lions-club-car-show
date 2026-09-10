import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { connectTarget } from '../phase1a/db';
async function main(){const db=await connectTarget();try{
 await db.exec('BEGIN');
 const actor=(await db.query("SELECT id FROM public.profiles WHERE is_active AND app_role='admin' LIMIT 1")).rows[0].id;
 const event=(await db.query("INSERT INTO public.events(slug,name,event_year,judging_open) VALUES ($1,'Temporary numeric parity',2026,true) RETURNING id",[`numeric-${randomUUID()}`])).rows[0].id;
 const car=(await db.query('SELECT id FROM public.cars LIMIT 1')).rows[0].id;
 const reg=(await db.query('SELECT * FROM car_show_private.register_car($1,$2)',[event,car])).rows[0].id;
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);await db.exec('SET LOCAL ROLE authenticated');
 for(const [raw,expected] of [['{"coverage":1.0}',1],['{"coverage":"00000000000000000000001"}',1],['{"coverage":0}',0],['{"coverage":""}',null]] as const){
   await db.query("SELECT public.submit_section($1,'body_paint',$2,$3)",[reg,raw,randomUUID()]);
   assert.equal((await db.query('SELECT coverage FROM public.judge_score($1)',[reg])).rows[0].coverage,expected);
 }
 for(const raw of ['{"coverage":1.5}','{"coverage":"1.0"}','{"coverage":-1}','{"coverage":16}']){
   await db.exec('SAVEPOINT invalid_input');
   await assert.rejects(db.query("SELECT public.submit_section($1,'body_paint',$2,$3)",[reg,raw,randomUUID()]));
   await db.exec('ROLLBACK TO SAVEPOINT invalid_input');
 }
 await db.exec('ROLLBACK');
 await writeFile('docs/car-show-phase1b/numeric-test-report.json',JSON.stringify({passed:true,engine:'target Supabase Postgres',role:'authenticated with existing Admin subject',accepted:['integral JSON 1.0','zero-padded digits','zero','blank as NULL'],rejected:['fraction','decimal string','negative','above maximum'],all_test_writes_rolled_back:true},null,2)+'\n');
 console.log('Target numeric parity passed; every test write rolled back.');
}finally{await db.exec('ROLLBACK');await db.close();}}
main().catch(()=>{console.error('Numeric parity test failed; no private values logged');process.exitCode=1;});
