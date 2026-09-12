import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers';
import {randomUUID} from 'node:crypto';
test('arrival requires color, records current and event color, and preserves previous snapshots',async()=>{
 const {db,close}=await database();try{
 const actor=randomUUID();await db.query('insert into auth.users(id) values($1)',[actor]);await db.query("insert into profiles(id,display_name,app_role,is_active) values($1,'Admin','admin',true)",[actor]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
 const p=(await db.query("insert into participants(name,email) values('Test','') returning id")).rows[0].id;
 const c=(await db.query("insert into cars(participant_id,year,make,model) values($1,1959,'Test','Car') returning id",[p])).rows[0].id;
 const e=(await db.query("insert into events(slug,name,event_year) values('color','Color',2026) returning id")).rows[0].id;
 await db.exec('set role authenticated');await assert.rejects(db.query("select admin_arrival($1,$2,$3,'Paid','')",[e,p,c]));
 const r=(await db.query("select admin_arrival($1,$2,$3,'Paid',' Blue ') id",[e,p,c])).rows[0].id;
 const first=(await db.query('select checked_in_at from event_registrations where id=$1',[r])).rows[0].checked_in_at;assert.ok(first);await db.query("select admin_arrival($1,$2,$3,'Paid','Blue')",[e,p,c]);assert.deepEqual((await db.query('select checked_in_at from event_registrations where id=$1',[r])).rows[0].checked_in_at,first);
 await db.exec('reset role');assert.equal((await db.query('select color from cars where id=$1',[c])).rows[0].color,'Blue');
 await db.query("update cars set color='Red' where id=$1",[c]);assert.equal((await db.query('select vehicle_color from event_registrations where id=$1',[r])).rows[0].vehicle_color,'Blue');
 const publicData=(await db.query('select registration_progress($1) data',[r])).rows[0].data as {vehicle_color:string};assert.equal(publicData.vehicle_color,'Blue');
 }finally{await close();}
});
