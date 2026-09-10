import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile,writeFile,access,unlink } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { connectTarget } from '../phase1a/db';
import { validateWorkflows } from './validate';
import { SECTIONS,FIELDS } from '../../src/domain/scoring';
const {encodeReply}=createRequire(import.meta.url)('next/dist/compiled/react-server-dom-webpack/client.node');
async function main(){
 const base='http://127.0.0.1:3000',db=await connectTarget(),run=randomUUID(),events:string[]=[],users:string[]=[],participants:string[]=[],checks:string[]=[];
 const privileged=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}).auth.admin;
 const manifest=JSON.parse(await readFile('.next/server/server-reference-manifest.json','utf8'));
 const originallyOpen=(await db.query('SELECT id FROM public.events WHERE judging_open')).rows.map(r=>r.id);
 async function session(role:'admin'|'judge'){
  const email=`workflow-${role}-${run}@example.invalid`,password=`Test!${randomUUID()}`;
  const created=await privileged.createUser({email,password,email_confirm:true});assert.equal(created.error,null);const user=created.data.user!.id;users.push(user);
  await db.query('INSERT INTO public.profiles(id,display_name,app_role,is_active) VALUES ($1,$2,$3,true) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,app_role=excluded.app_role,is_active=true',[user,`Workflow ${role}`,role]);
  const jar=new Map<string,string>();const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>jar.set(v.name,v.value))}});assert.equal((await client.auth.signInWithPassword({email,password})).error,null);
  const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
  async function action(name:string,values:Record<string,string|string[]>,path='/admin'){
   const actionId=Object.entries(manifest.node).find(([,v])=>(v as {exportedName:string}).exportedName===name)?.[0];assert.ok(actionId,`Action ${name} exists`);
   const form=new FormData();for(const [k,v]of Object.entries(values))for(const x of Array.isArray(v)?v:[v])form.append(k,x);
   const body=await encodeReply([{message:''},form]);const response=await fetch(base+path,{method:'POST',headers:{Cookie:cookie(),Origin:base,'Next-Action':actionId,...(typeof body==='string'?{'Content-Type':'text/plain;charset=UTF-8'}:{})},body,redirect:'manual'});
   for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],index=pair.indexOf('=');jar.set(pair.slice(0,index),pair.slice(index+1));}
   assert.ok([200,303].includes(response.status),`${name}: HTTP ${response.status}`);return {response,text:await response.text()};
  }
  return {client,action,get:(path:string)=>fetch(base+path,{headers:{Cookie:cookie()},redirect:'manual'})};
 }
 try{
  const admin=await session('admin'),judge=await session('judge');
  async function assertRedirect(response:Response,to:string){if(response.status===307){assert.equal(response.headers.get('location'),to);return;}assert.equal(response.status,200);const body=await response.text();assert.ok(body.includes('NEXT_REDIRECT')&&body.includes(to),'Streaming loading boundary retains the authorization redirect');assert.ok(!body.includes('Registered</span>'),'Unauthorized response contains no dashboard data');}
  await assertRedirect(await fetch(base+'/admin',{redirect:'manual'}),'/sign-in');await assertRedirect(await judge.get('/admin'),'/judge');
  await admin.action('saveEvent',{name:`Workflow test ${run}`,year:'2026',date:'2026-09-09'},'/admin/events');
  const event=(await db.query('SELECT id FROM public.events WHERE name=$1',[`Workflow test ${run}`])).rows[0]?.id as string;assert.ok(event);events.push(event);
  await admin.action('saveParticipant',{name:`Workflow entrant ${run}`,email:`entrant-${run}@example.invalid`},'/admin/participants');
  const participant=(await db.query('SELECT id FROM public.participants WHERE email=$1',[`entrant-${run}@example.invalid`])).rows[0]?.id as string;assert.ok(participant);participants.push(participant);
  for(const model of ['First','Second'])await admin.action('saveCar',{participant,year:'1955',make:'Workflow',model},`/admin/participants/${participant}`);
  const cars=(await db.query('SELECT id FROM public.cars WHERE participant_id=$1 ORDER BY model',[participant])).rows.map(r=>String(r.id));assert.equal(cars.length,2);
  for(const car of cars)await admin.action('submitVehicleRegistration',{event,participant,car,cars:car,payment:'Unpaid',operation:'pre-register'},`/admin/participants/${participant}`);
  const regs=(await db.query('SELECT * FROM public.event_registrations WHERE event_id=$1 ORDER BY car_number',[event])).rows as {id:string;car_number:unknown}[];assert.deepEqual(regs.map(r=>r.car_number),[null,null]);
  const arrivals=await Promise.all(cars.map(car=>admin.action('submitVehicleRegistration',{event,participant,car,cars:car,payment:'Paid',operation:'check-in'},`/admin/participants/${participant}`)));for(const arrival of arrivals)assert.ok(arrival.response.headers.get('x-action-redirect')?.includes('/print'));assert.ok((await db.query('SELECT payment_status FROM public.event_registrations WHERE event_id=$1',[event])).rows.every(r=>r.payment_status==='Paid'));assert.deepEqual((await db.query('SELECT car_number::text as n FROM public.event_registrations WHERE event_id=$1 ORDER BY car_number',[event])).rows.map(r=>r.n),['1','2']);
  const before=(await db.query('SELECT next_car_number::text AS n FROM public.events WHERE id=$1',[event])).rows[0].n;await admin.action('arriveCar',{event,participant,car:cars[0],payment:'Paid'},`/admin/check-in/${participant}`);assert.equal((await db.query('SELECT next_car_number::text AS n FROM public.events WHERE id=$1',[event])).rows[0].n,before);
  await admin.action('updateRegistration',{id:regs[0].id,status:'Checked-in',payment:'Paid'},`/admin/registrations/${regs[0].id}`);
  await admin.action('openJudging',{event,open:'true'},'/admin/events');
  checks.push('HTTP Admin event, participant, two cars, unnumbered pre-registration, concurrent arrival numbering, idempotent reprint and payment');
  const sectionEntries=Object.entries(SECTIONS);
  for(let offset=0;offset<sectionEntries.length;offset+=2){const chosen=sectionEntries.slice(offset,offset+2);const values:Record<string,string|string[]>={registration:regs[0].id,sections:chosen.map(([section])=>section)};for(const [section,fields]of chosen){values[`request_${section}`]=randomUUID();for(const [field,max]of Object.entries(fields))values[field]=String(max);}const result=await judge.action('submitSelectedSections',values,`/judge/registrations/${regs[0].id}`);assert.ok(result.text.includes('Saved 2 sections'));}
  const publicResponse=await fetch(base+`/judge/registrations/${regs[0].id}`);assert.equal(publicResponse.status,200);const publicHtml=await publicResponse.text();assert.ok(publicHtml.includes('Judging progress'));assert.ok(publicHtml.includes(`Workflow entrant ${run}`));assert.ok(!publicHtml.includes(`entrant-${run}@example.invalid`));assert.ok(!publicHtml.includes('Workflow judge'));assert.ok(!publicHtml.includes('Judging sheet'));assert.ok(!publicHtml.includes('Submission history'));
  checks.push('Anonymous QR shows owner and progress only; three atomic two-section Judge saves retain six history entries');
  const score=(await db.query('SELECT * FROM public.scores WHERE event_registration_id=$1',[regs[0].id])).rows[0];assert.equal(Number(score.progress_percentage),100);assert.equal((await db.query('SELECT status FROM public.event_registrations WHERE id=$1',[regs[0].id])).rows[0].status,'Judged');
  const expected=Object.fromEntries(FIELDS.map(k=>[k,score[k]]));
  const quick=await admin.action('quickEdit',{registration:regs[0].id,request:randomUUID(),expected:JSON.stringify(expected),...Object.fromEntries(FIELDS.map((k,i)=>[k,i===0?'':i===1?'0':String(score[k])]))},'/admin/scores');assert.ok(quick.text.includes('Quick Edit saved'));
  const edited=(await db.query('SELECT * FROM public.scores WHERE event_registration_id=$1',[regs[0].id])).rows[0];assert.equal(edited[FIELDS[0]],null);assert.equal(edited[FIELDS[1]],0);assert.equal((await db.query('SELECT status FROM public.event_registrations WHERE id=$1',[regs[0].id])).rows[0].status,'Judged');
  await judge.action('voteLionsChoice',{registration:regs[1].id},`/judge/registrations/${regs[1].id}`);assert.equal((await db.query('SELECT count(*)::int AS n FROM public.scores WHERE event_registration_id=$1',[regs[1].id])).rows[0].n,0);
  assert.equal((await db.query('SELECT lions_choice_votes FROM public.event_registrations WHERE id=$1',[regs[1].id])).rows[0].lions_choice_votes,1);
  const denied=await judge.action('saveEvent',{name:'Denied',year:'2026'},'/admin/events');assert.ok(denied.response.headers.get('x-action-redirect')?.startsWith('/judge'));
  checks.push('Six HTTP Judge saves reach 100%; Admin blank/zero Quick Edit keeps Judged and audits; votes require no score; forged Judge Admin action denied');
  for(const path of ['/admin','/admin/events','/admin/participants',`/admin/participants/${participant}`,'/admin/registrations',`/admin/check-in/${participant}`,`/admin/registrations/${regs[0].id}`,'/admin/scores','/admin/awards','/admin/import','/admin/users',`/judge/registrations/${regs[0].id}`])assert.equal((await admin.get(path)).status,200,path);
  const print=await admin.get(`/admin/registrations/${regs[0].id}/print`);const printed=await print.text();assert.equal(print.status,200);assert.ok(printed.includes('<svg'));assert.ok(printed.includes(`/judge/registrations/${regs[0].id}`));
  const live=await admin.get(`/admin/awards/live?event=${event}`);assert.equal(live.status,200);assert.ok((await live.text()).includes('First'));
  await admin.action('saveCar',{participant,car:cars[0],year:'2001',make:'Changed',model:'Changed'},`/admin/participants/${participant}`);assert.equal((await db.query('SELECT vehicle_year FROM public.event_registrations WHERE id=$1',[regs[0].id])).rows[0].vehicle_year,1955);
  checks.push('All workflow pages, printable local QR, awards endpoint and immutable registration snapshot');
  const history=await judge.client.rpc('judge_full_history',{p_registration:regs[0].id});assert.equal(history.error,null);assert.equal(history.data.length,7);
  if(process.env.WORKFLOW_UI_REVIEW==='1'){const marker='.car-show-private/ui-review.json';await writeFile(marker,JSON.stringify({registration:regs[0].id,participant,event}));try{for(let i=0;i<120;i++){try{await access(marker);}catch{break;}await new Promise(resolve=>setTimeout(resolve,1000));}}finally{await unlink(marker).catch(()=>{});}}
 }finally{
  for(const user of users)assert.equal((await privileged.deleteUser(user)).error,null);
  await db.exec('BEGIN');try{
   await db.exec('ALTER TABLE public.score_history DISABLE TRIGGER score_history_immutable');
   await db.query('DELETE FROM public.score_history WHERE legacy_update_id IS NULL AND score_id IN (SELECT s.id FROM public.scores s JOIN public.event_registrations r ON r.id=s.event_registration_id WHERE r.event_id=ANY($1::uuid[]))',[events]);
   await db.exec('ALTER TABLE public.score_history ENABLE TRIGGER score_history_immutable');
   await db.query('DELETE FROM public.scores WHERE legacy_score_id IS NULL AND event_registration_id IN (SELECT id FROM public.event_registrations WHERE event_id=ANY($1::uuid[]))',[events]);
   await db.query('DELETE FROM public.event_registrations WHERE legacy_car_id IS NULL AND event_id=ANY($1::uuid[])',[events]);
   await db.query('DELETE FROM public.events WHERE legacy_source_key IS NULL AND id=ANY($1::uuid[])',[events]);
   await db.query('DELETE FROM public.cars WHERE legacy_car_id IS NULL AND participant_id=ANY($1::uuid[])',[participants]);
   await db.query('DELETE FROM public.participants WHERE legacy_participant_id IS NULL AND id=ANY($1::uuid[])',[participants]);
   await db.query('UPDATE public.events SET judging_open=true WHERE id=ANY($1::uuid[])',[originallyOpen]);await db.exec('COMMIT');
  }catch(error){await db.exec('ROLLBACK');throw error;}
  const preservation=await validateWorkflows(db);await db.close();await writeFile('docs/car-show-workflows/http-test-report.json',JSON.stringify({checks,preservation,temporary_data_removed:true},null,2)+'\n');
 }
 console.log(JSON.stringify({passed:true,checks},null,2));
}
main().catch(error=>{console.error('Workflow HTTP test failed: '+String(error?.stack).split('\n').filter(line=>line.includes('http-tests.ts')).join(' '));process.exitCode=1;});
