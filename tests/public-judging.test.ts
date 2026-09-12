import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from './helpers';
import { SECTIONS,FIELDS } from '../src/domain/scoring';
test('public QR is a narrow projection; complete multi-section saves are atomic and attributed',async()=>{
 const {db,close}=await database();try{
 const actor=randomUUID();await db.query('INSERT INTO auth.users(id) VALUES ($1)',[actor]);await db.query("INSERT INTO public.profiles(id,display_name,app_role,is_active) VALUES ($1,'Test judge','admin',true)",[actor]);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor]);
 const person=(await db.query("INSERT INTO public.participants(name,email,phone,address,city,state,zip) VALUES ('Owner','secret@example.invalid','secret phone','secret address','City','IN','00100') RETURNING id")).rows[0].id;
 const car=(await db.query("INSERT INTO public.cars(participant_id,year,make,model,notes) VALUES ($1,1959,'Test','Car','private notes') RETURNING id",[person])).rows[0].id;
 const event=(await db.query("INSERT INTO public.events(slug,name,event_year,judging_open) VALUES ('public-test','Test event',2026,true) RETURNING id")).rows[0].id;
 const reg=(await db.query('SELECT id FROM public.admin_register_car($1,$2)',[event,car])).rows[0].id;
 assert.equal((await db.query('SELECT public.registration_progress($1) AS data',[reg])).rows[0].data,null);
 await db.query("SELECT public.admin_arrival($1,$2,$3,'Paid')",[event,person,car]);
 await db.exec('SET ROLE anon');const projection=(await db.query('SELECT public.registration_progress($1) AS data',[reg])).rows[0].data as Record<string,unknown>;
 assert.equal(projection.owner_name,'Owner');assert.equal(projection.owner_city,'City');assert.equal(projection.owner_state,'IN');assert.equal(projection.car_number,'1');
 assert.deepEqual(Object.keys(projection).sort(),['id','car_number','vehicle_year','vehicle_color','vehicle_make','vehicle_model','owner_name','owner_city','owner_state','event_name','event_year','historical','judging_open','progress','sections'].sort());assert.ok(!JSON.stringify(projection).includes('secret'));assert.ok(Object.values(projection.sections as object).every(v=>v===false));
 await assert.rejects(db.query('SELECT * FROM public.scores'),/permission denied/);await assert.rejects(db.query('SELECT public.submit_sections($1,$2)',[reg,[]]),/permission denied/);await db.exec('RESET ROLE');
 await db.query("UPDATE public.profiles SET app_role='judge' WHERE id=$1",[actor]);await db.exec('SET ROLE authenticated');
 const payload=[{section:'body_paint',values:SECTIONS.body_paint,request:randomUUID()},{section:'interior',values:{dash:0},request:randomUUID()}];
 await assert.rejects(db.query('SELECT public.submit_sections($1,$2)',[reg,payload]),/Complete every/);assert.equal((await db.query('SELECT * FROM public.judge_score($1)',[reg])).rows.length,0);
 payload[1].values=SECTIONS.interior;const first=(await db.query('SELECT public.submit_sections($1,$2) AS ids',[reg,payload])).rows[0].ids;assert.deepEqual((await db.query('SELECT public.submit_sections($1,$2) AS ids',[reg,payload])).rows[0].ids,first);
 const history=(await db.query('SELECT * FROM public.judge_history($1)',[reg])).rows;assert.equal(history.length,2);
 await assert.rejects(db.query("SELECT public.submit_section($1,'engine',$2,$3)",[reg,{block:0},randomUUID()]),/Complete every/);
 await db.exec('RESET ROLE');const saved=(await db.query('SELECT * FROM public.score_history')).rows;assert.ok(saved.every(h=>h.user_id===actor&&h.judge_name_snapshot==='Test judge'&&h.submitted_at));
 const publicData=(await db.query('SELECT public.registration_progress($1) AS data',[reg])).rows[0].data as {sections:Record<string,boolean>;progress:number};assert.equal(publicData.sections.body_paint,true);assert.equal(publicData.sections.interior,true);assert.equal(publicData.sections.engine,false);
 await db.query("UPDATE public.profiles SET app_role='admin' WHERE id=$1",[actor]);const score=(await db.query('SELECT * FROM public.scores')).rows[0];const before=Object.fromEntries(FIELDS.map(f=>[f,score[f]]));await db.query('SELECT public.admin_quick_edit($1,$2,$3,$4)',[reg,{...before,coverage:null},before,randomUUID()]);assert.equal(((await db.query('SELECT public.registration_progress($1) AS data',[reg])).rows[0].data as {sections:Record<string,boolean>}).sections.body_paint,false);
 }finally{await close();}
});
