/** Bounded staging DML tests. No schema changes, Auth users, or source-row commits.
 * Snapshot edits always roll back; concurrency uses a fresh event removed in finally.
 */
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { connectTarget } from './db';
import { prepareSource } from './cli';
import { assertFixture, AwardMismatch, targetAwards, validateTarget } from './reconcile';
async function main(){
  const source=await prepareSource();
  const db=await connectTarget(); const second=await connectTarget();
  let testEvent:string|undefined;
  try{
    await validateTarget(db,source.mapped);
    await db.exec('BEGIN');
    try{
      await db.exec("UPDATE public.cars SET year=2001, make='Phase1A snapshot test', model='Rollback only'");
      await assertFixture((await targetAwards(db)).awards);
    }finally{await db.exec('ROLLBACK');}
    const event=(await db.query("INSERT INTO public.events(slug,name,event_year) VALUES ($1,'Disposable Phase 1A concurrency test',2026) RETURNING id,timezone_name,next_car_number::text",['phase1a-test-'+randomUUID()])).rows[0];
    testEvent=String(event.id);
    assert.equal(event.timezone_name,'America/Indiana/Indianapolis'); assert.equal(event.next_car_number,'1');
    const registrations=await Promise.all([
      db.query('SELECT * FROM car_show_private.register_car($1,$2)',[testEvent,source.mapped.cars[0].id]),
      second.query('SELECT * FROM car_show_private.register_car($1,$2)',[testEvent,source.mapped.cars[1].id]),
    ]);
    assert.deepEqual(registrations.map(r=>String(r.rows[0].car_number)).sort(),['1','2']);
    const registration=registrations[0].rows[0].id;
    await Promise.all([db,second].map(async connection=>{
      for(let i=0;i<10;i++) await connection.query('SELECT car_show_private.vote_lions_choice($1)',[registration]);
    }));
    assert.equal((await db.query('SELECT lions_choice_votes FROM public.event_registrations WHERE id=$1',[registration])).rows[0].lions_choice_votes,20);
    assert.equal((await db.query('SELECT count(*)::text AS n FROM public.scores WHERE event_registration_id=$1',[registration])).rows[0].n,'0');
    await assert.rejects(db.query('SELECT * FROM car_show_private.register_car($1,$2)',[testEvent,source.mapped.cars[0].id]));
    assert.equal((await db.query('SELECT next_car_number::text FROM public.events WHERE id=$1',[testEvent])).rows[0].next_car_number,'3');
    await db.query('DELETE FROM public.event_registrations WHERE event_id=$1',[testEvent]);
    await db.query('DELETE FROM public.events WHERE id=$1',[testEvent]); testEvent=undefined;
    const report=await validateTarget(db,source.mapped);
    console.log(JSON.stringify({vehicle_edit_2025_fixture:'unchanged; edits rolled back',concurrent_numbers:['1','2'],concurrent_votes:20,voting_created_scores:0,disposable_event_removed:true,report},null,2));
  }finally{
    if(testEvent){
      await db.query('DELETE FROM public.event_registrations WHERE event_id=$1',[testEvent]);
      await db.query('DELETE FROM public.events WHERE id=$1',[testEvent]);
    }
    await second.close();await db.close();
  }
}
main().catch(error=>{
  if(error instanceof AwardMismatch) console.error(JSON.stringify({error:error.message,differences:error.differences}));
  else console.error(`Staging validation failed (${error?.code??'assertion'}); private row values suppressed.`);
  process.exitCode=1;
});
