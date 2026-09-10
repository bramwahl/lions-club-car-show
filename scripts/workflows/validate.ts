import { writeFile } from 'node:fs/promises';
import { connectTarget,type DB } from '../phase1a/db';
import { regression } from '../phase1b/validate';
import { assertFixture } from '../phase1a/reconcile';
import { EVENT_ID } from '../phase1a/mapping';
import { calculateAwards,type AwardInput } from '../../src/domain/awards';
export async function validateWorkflows(db:DB){
 const columns:Record<string,string>={events:'legacy_source_key',participants:'legacy_participant_id',cars:'legacy_car_id',event_registrations:'legacy_car_id',scores:'legacy_score_id',score_history:'legacy_update_id'};
 const legacy:DB={exec:sql=>db.exec(sql),query:(sql,params)=>{const match=sql.match(/FROM public\.(events|participants|cars|event_registrations|scores|score_history)$/);return db.query(match?`${sql} WHERE ${columns[match[1]]} IS NOT NULL`:sql,params);}};
 const preserved=await regression(legacy);
 await db.exec('BEGIN');try{const actor=(await db.query("SELECT id FROM public.profiles WHERE app_role='admin' AND is_active LIMIT 1")).rows[0]?.id;if(!actor)throw new Error('Active Admin required');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[actor]);const input=(await db.query('SELECT public.admin_award_inputs($1) AS input',[EVENT_ID])).rows[0].input as AwardInput[];const fixture=await assertFixture(calculateAwards(input));return {legacy:preserved,application_awards_rpc:fixture};}finally{await db.exec('ROLLBACK');}
}
async function main(){const db=await connectTarget();try{const report=await validateWorkflows(db);await writeFile('docs/car-show-workflows/regression-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}finally{await db.close();}}
if(process.argv[1]?.endsWith('/validate.ts'))main().catch(()=>{console.error('Workflow legacy regression failed; no private values logged');process.exitCode=1;});
