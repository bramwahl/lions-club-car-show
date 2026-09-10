import test from 'node:test';
import assert from 'node:assert/strict';
import { database, syntheticSource } from './helpers';
import { entityId, EVENT_ID, mapSource } from '../scripts/phase1a/mapping';
import { importMapped, inputHash } from '../scripts/phase1a/importer';
import { compareRows } from '../scripts/phase1a/reconcile';
import { migrate } from '../scripts/phase1a/db';
const provenance={sourceSha:'synthetic-only',nativeVersion:'test-only',inputSha:'test-only'};
test('actual Postgres engine: source mapping, rerun, tamper refusal, repeated history and rollback',async()=>{
  const {db,close}=await database();
  try{
    const mapped=mapSource(syntheticSource());
    assert.equal(inputHash(mapped),inputHash(mapSource(syntheticSource())));
    assert.equal((await importMapped(db,mapped,provenance,compareRows)).mode,'imported');
    assert.equal((await importMapped(db,mapped,provenance,compareRows)).mode,'verified-no-op');
    assert.equal((await db.query('SELECT count(*)::text AS n FROM public.score_history')).rows[0].n,'2');
    assert.equal((await db.query('SELECT legacy_wp_user_id::text AS n FROM public.score_history LIMIT 1')).rows[0].n,'9007199254740993');
    await db.query("UPDATE public.participants SET city='Changed' WHERE id=$1",[mapped.participants[0].id]);
    await assert.rejects(importMapped(db,mapped,provenance,compareRows),/Target changed/);
    assert.equal((await db.query('SELECT city FROM public.participants')).rows[0].city,'Changed');
    await assert.rejects(importMapped(db,mapped,{...provenance,sourceSha:'changed'},compareRows),/provenance changed/);
    await migrate(db); // checksummed migration rerun
    await db.query("UPDATE car_show_private.schema_migrations SET sha256='tampered' WHERE name=(SELECT min(name) FROM car_show_private.schema_migrations)");
    await assert.rejects(migrate(db),/Migration history differs/);
  }finally{await close();}
});
test('failed validation rolls back every imported row and run metadata',async()=>{
  const {db,close}=await database();
  try{
    await assert.rejects(importMapped(db,mapSource(syntheticSource()),provenance,async()=>{throw new Error('Gate failed');}),/Gate failed/);
    for(const table of ['participants','cars','scores','score_history']) assert.equal((await db.query(`SELECT count(*)::text AS n FROM public.${table}`)).rows[0].n,'0');
    assert.equal((await db.query('SELECT count(*)::text AS n FROM car_show_private.import_runs')).rows[0].n,'0');
  }finally{await close();}
});
test('generated totals, history constraints, immutable snapshots and votes without scores',async()=>{
  const {db,close}=await database();
  try{
    const mapped=mapSource(syntheticSource());await importMapped(db,mapped,provenance,compareRows);
    await assert.rejects(db.query('UPDATE public.scores SET total_score=0'),/can only be updated to DEFAULT/);
    await assert.rejects(db.query('UPDATE public.scores SET coverage=16'),/check constraint/);
    await assert.rejects(db.query('DELETE FROM public.score_history'),/append-only/);
    await assert.rejects(db.query('UPDATE public.score_history SET section=\'interior\''),/append-only/);
    await assert.rejects(db.query('DELETE FROM public.scores'),/foreign key/);
    await assert.rejects(db.query('UPDATE public.event_registrations SET vehicle_year=2000'),/immutable/);
    await db.query("UPDATE public.cars SET year=2000,make='Current',model='Edited'");
    assert.equal((await db.query('SELECT vehicle_year FROM public.event_registrations')).rows[0].vehicle_year,1959);
    const event=(await db.query("INSERT INTO public.events(slug,name,event_year) VALUES ('new','New',2026) RETURNING id, timezone_name,next_car_number::text")).rows[0];
    assert.equal(event.timezone_name,'America/Indiana/Indianapolis');assert.equal(event.next_car_number,'1');
    const registration=(await db.query('SELECT * FROM car_show_private.register_car($1,$2)',[event.id,mapped.cars[0].id])).rows[0];
    assert.equal(registration.vehicle_year,2000);
    await db.query('SELECT car_show_private.vote_lions_choice($1)',[registration.id]);
    assert.equal((await db.query('SELECT count(*)::text AS n FROM public.scores')).rows[0].n,'1');
    assert.equal((await db.query('SELECT lions_choice_votes FROM public.event_registrations WHERE id=$1',[registration.id])).rows[0].lions_choice_votes,1);
    await assert.rejects(db.query('SELECT car_show_private.register_car($1,$2)',[event.id,mapped.cars[0].id]),/unique constraint/);
    assert.equal((await db.query('SELECT next_car_number::text FROM public.events WHERE id=$1',[event.id])).rows[0].next_car_number,'2');
    await assert.rejects(db.query('UPDATE public.events SET next_car_number=1 WHERE id=$1',[event.id]),/rewind/);
    await assert.rejects(db.query("INSERT INTO public.events(slug,name,event_year,timezone_name) VALUES ('bad','Bad',2026,NULL)"),/timezone/);
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.participants'),/permission denied/);
    await assert.rejects(db.query('SELECT car_show_private.vote_lions_choice($1)',[registration.id]),/permission denied/);
    await db.exec('RESET ROLE');
    assert.equal(EVENT_ID,mapped.events[0].id);
    assert.equal(entityId('score','3'),mapped.scores[0].id);
  }finally{await close();}
});
test('history action constraints and Auth deletion preserve all attribution and audit payloads',async()=>{
  const {db,close}=await database();
  try{
    const mapped=mapSource(syntheticSource());await importMapped(db,mapped,provenance,compareRows);
    const actor='00000000-0000-4000-8000-000000000001';
    await db.query('INSERT INTO auth.users(id) VALUES ($1)',[actor]);
    await db.query("INSERT INTO public.profiles(id,display_name) VALUES ($1,'Synthetic admin')",[actor]);
    const vector=Object.fromEntries((await import('../src/domain/scoring')).FIELDS.map(k=>[k,0]));
    const insert=`INSERT INTO public.score_history(score_id,action_type,section,user_id,judge_name_snapshot,submitted_at,timestamp_basis,score_values_before,score_values_after)
      VALUES ($1,$2,$3,$4,'Synthetic admin',now(),'auth-server',$5,$6) RETURNING id`;
    await assert.rejects(db.query(insert,[mapped.scores[0].id,'section_submission',null,actor,null,null]),/check constraint/);
    await assert.rejects(db.query(insert,[mapped.scores[0].id,'admin_quick_edit','engine',actor,vector,vector]),/check constraint/);
    await assert.rejects(db.query(insert,[mapped.scores[0].id,'section_submission','fake_section',actor,null,null]),/check constraint/);
    await assert.rejects(db.query(insert,[mapped.scores[0].id,'admin_quick_edit',null,actor,{},{}]),/check constraint/);
    await assert.rejects(db.query(insert,[mapped.scores[0].id,'admin_quick_edit',null,actor,vector,{...vector,coverage:1.5}]),/check constraint/);
    const history=(await db.query(insert,[mapped.scores[0].id,'admin_quick_edit',null,actor,vector,vector])).rows[0];
    await assert.rejects(db.query('UPDATE public.score_history SET user_id=NULL WHERE id=$1',[history.id]),/append-only/);
    await db.query('DELETE FROM auth.users WHERE id=$1',[actor]);
    const retained=(await db.query('SELECT user_id,judge_name_snapshot,score_values_after FROM public.score_history WHERE id=$1',[history.id])).rows[0];
    assert.equal(retained.user_id,null);assert.equal(retained.judge_name_snapshot,'Synthetic admin');assert.deepEqual(retained.score_values_after,vector);
    assert.equal((await db.query('SELECT count(*)::text AS n FROM public.profiles')).rows[0].n,'0');
    assert.equal((await db.query('SELECT count(*)::text AS n FROM public.score_history')).rows[0].n,'3');
  }finally{await close();}
});
test('Postgres generated score maxima and zero/NULL match core calculations',async()=>{
  const {db,close}=await database();
  try{
    const mapped=mapSource(syntheticSource());await importMapped(db,mapped,provenance,compareRows);
    const {MAXIMA,FIELDS,calculate}=await import('../src/domain/scoring');
    for(const vector of [MAXIMA,Object.fromEntries(FIELDS.map(k=>[k,0])),{...MAXIMA,coverage:null}]){
      await db.query(`UPDATE public.scores SET ${FIELDS.map((k,i)=>`${k}=$${i+1}`).join(',')}`,FIELDS.map(k=>(vector as Record<string,number|null>)[k]));
      const totals=(await db.query('SELECT total_score,overall_paint,overall_interior,overall_engine FROM public.scores')).rows[0];
      const expected=calculate(vector);for(const k of Object.keys(totals)) assert.equal(totals[k],expected[k as keyof typeof expected]);
    }
  }finally{await close();}
});
test('mapping preserves duplicate participants and Unicode without confusing car numbers',async()=>{
  const source=syntheticSource();
  source.participants.push({...source.participants[0],id:'2',name:'D’Agostino — é',city:'',email:''});
  source.cars.push({...source.cars[0],id:'1',car_number:'2',participant_id:'2'});
  const mapped=mapSource(source);
  assert.equal(mapped.participants.length,2);
  assert.equal(mapped.participants[1].name,'D’Agostino — é');
  assert.equal(mapped.event_registrations[1].car_number,'2');
  assert.equal(mapped.event_registrations[1].car_id,entityId('car','1'));
  assert.equal(mapped.event_registrations[1].lions_choice_votes,'0');
  assert.equal(mapped.event_registrations[0].lions_choice_votes,'2');
  assert.equal(mapped.scores[0].event_registration_id,mapped.event_registrations[0].id);
  source.cars.push({...source.cars[0]});assert.throws(()=>mapSource(source),/Duplicate/);
});
