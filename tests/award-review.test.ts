import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from './helpers';
import { repeatedAwardKeys } from '../src/workflows/award-review';
import type { Award } from '../src/domain/awards';
test('repeat warning matches exact award and car identity, not number or category alone',()=>{
 const a=(car_id:string,award:string)=>({car_id,award} as Award);
 assert.deepEqual(repeatedAwardKeys([a('a','Best in Show'),a('b','Top 40: 2')],[a('a','Best in Show'),a('b','Top 40: 1')]),['a|Best in Show']);
});
test('manual Lions Choice is admin-only, event-scoped, concurrency guarded and independent of scores/votes',async()=>{
 const {db,close}=await database();try{
 const actor=randomUUID();await db.query('insert into auth.users(id) values($1)',[actor]);await db.query("insert into public.profiles(id,display_name,app_role,is_active) values($1,'Test admin','admin',true)",[actor]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
 const p=(await db.query("insert into public.participants(name,email) values('Test','') returning id")).rows[0].id;
 const e=(await db.query("insert into public.events(slug,name,event_year) values('choice','Choice',2026) returning id")).rows[0].id;
 const cars=[];for(let i=0;i<2;i++){const c=(await db.query("insert into public.cars(participant_id,year,make,model) values($1,1955,'Test','Car') returning id",[p])).rows[0].id;cars.push((await db.query("select public.admin_arrival($1,$2,$3,'Unpaid') as id",[e,p,c])).rows[0].id);}
 await db.exec('set role authenticated');await db.query('select public.admin_confirm_lions_choice($1,$2,null)',[e,cars[0]]);await assert.rejects(db.query('select public.admin_confirm_lions_choice($1,$2,null)',[e,cars[1]]),/Winner changed/);await db.query('select public.admin_confirm_lions_choice($1,$2,$3)',[e,cars[1],cars[0]]);
 assert.equal(((await db.query('select public.admin_lions_choice($1) as c',[e])).rows[0].c as {registration_id:string}).registration_id,cars[1]);
 await db.exec('reset role');assert.equal((await db.query('select * from public.scores')).rows.length,0);assert.equal(Number((await db.query('select sum(lions_choice_votes) as n from public.event_registrations')).rows[0].n),0);
 await db.query("update public.profiles set app_role='judge' where id=$1",[actor]);await db.exec('set role authenticated');await assert.rejects(db.query('select public.admin_confirm_lions_choice($1,$2,$3)',[e,cars[0],cars[1]]));await assert.rejects(db.query('select * from public.lions_choice_confirmations'));await db.exec('reset role');
 await db.query("update public.profiles set app_role='admin' where id=$1",[actor]);await db.query("update public.events set legacy_source_key='test-historical' where id=$1",[e]);await assert.rejects(db.query('select public.admin_confirm_lions_choice($1,$2,$3)',[e,cars[0],cars[1]]),/Historical/);
 }finally{await close();}
});

test('tie review flags Best in Show first and respects higher-award exclusions without changing winners',async()=>{
 const {calculateAwards}=await import('../src/domain/awards');const {awardTies}=await import('../src/workflows/award-review');
 const input=(id:string,total:number,year=1959)=>({car_id:id,legacy_car_id:null,legacy_score_id:null,car_number:id,vehicle_year:year,vehicle_make:'Test',vehicle_model:'Car',participant_name:'Test',participant_city:null,total_score:total,overall_paint:60,overall_interior:40,overall_engine:40});
 const inputs=[input('1',180),input('2',180),input('3',179)];const awards=calculateAwards(inputs);const before=JSON.stringify(awards);
 const ties=awardTies(inputs,awards);assert.equal(ties[0].award,'Best in Show');assert.deepEqual(ties[0].cars.map(c=>c.car_id),['1','2']);assert.equal(JSON.stringify(awards),before);
 assert.equal(ties.some(t=>t.award==='Best in Class: 1950s'),false);
 assert.equal(ties.some(t=>t.award==='Best in Category: Paint'),false);
 const corrected=[input('2',180),input('1',179),input('3',178)];assert.equal(awardTies(corrected,calculateAwards(corrected)).length,0);
 const classInputs=[input('1',180,1940),input('2',179),input('3',179)];assert.equal(awardTies(classInputs,calculateAwards(classInputs))[0].award,'Best in Class: 1950s');
});

test('prior winner indicator includes tied candidates even when they are not the displayed winner',()=>{
 const past=[{car_id:'returning',award:'Best in Show'} as Award];
 const candidates=[{car_id:'current',award:'Best in Show'},{car_id:'returning',award:'Best in Show'},{car_id:'returning',award:'Best in Class: 1950s'}];
 assert.deepEqual(repeatedAwardKeys(candidates,past),['returning|Best in Show']);
 assert.deepEqual(repeatedAwardKeys(candidates,[]),[]);
});
