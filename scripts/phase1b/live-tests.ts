import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { connectTarget } from '../phase1a/db';
import { provisionAccount } from '../../src/auth/accounts';
import { MAXIMA, SECTIONS } from '../../src/domain/scoring';
import { regression } from './validate';
async function main(){
 const db=await connectTarget();const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
 const publicKey=(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
 const secret=(process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY)!;
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 const anon=createClient(url,publicKey,options),admin=createClient(url,publicKey,options);
 const authCalls:string[]=[];
 const privileged=createClient(url,secret,{...options,global:{fetch:async(input,init)=>{
   const requestUrl=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   authCalls.push(`${init?.method??'GET'} ${requestUrl.pathname}`);return fetch(input,init);
 }}}).auth.admin;
 const ids:string[]=[];let event:string|undefined,participant:string|undefined,car:string|undefined;
 const checks:string[]=[];let stage='sign-in';
 const ok=(name:string)=>checks.push(name);
 const rpc=async(c:SupabaseClient,name:string,args?:Record<string,unknown>)=>{const r=await c.rpc(name,args);if(r.error) throw new Error(`RPC ${name} failed (${r.error.code})`);return r.data;};
 const denied=async(p:PromiseLike<{error:unknown;data:unknown}>)=>{const r=await p;assert.ok(r.error);};
 const create=async(role:'admin'|'judge',suffix:string)=>{
   const email=`phase1b-${randomUUID()}-${suffix}@example.invalid`,password=`T1!${randomUUID()}`;
   const created=await provisionAccount(privileged,{email,password,role,name:`Phase 1B ${suffix}`},async id=>{
     await rpc(admin,'admin_set_account',{p_user_id:id,p_role:role,p_active:true,p_name:`Phase 1B ${suffix}`});
   });ids.push(created.id);
   const client=createClient(url,publicKey,options);const result=await client.auth.signInWithPassword({email,password});if(result.error) throw new Error(`Test sign-in failed (${result.error.code}; ${result.error.status})`);assert.ok(result.data.user?.email_confirmed_at);
   return {id:created.id,client};
 };
 try{
  const login=await admin.auth.signInWithPassword({email:process.env.BOOTSTRAP_ADMIN_EMAIL!,password:process.env.BOOTSTRAP_ADMIN_PASSWORD!});assert.equal(login.error,null);assert.equal(await rpc(admin,'current_app_role'),'admin');ok('Initial Admin password authentication');
  stage='account creation';const judge=await create('judge','Judge');const other=await create('admin','Admin');ok('Admin creates confirmed Judge and Admin; both authenticate immediately');
  assert.ok(authCalls.filter(c=>c.startsWith('POST')).every(c=>c==='POST /auth/v1/admin/users'));ok('Provisioning transport uses only POST /auth/v1/admin/users; no email endpoints');
  stage='public denial';await denied(anon.from('participants').select('*'));await denied(anon.from('participants').select('name,email').ilike('name','%'));await denied(anon.rpc('judge_event'));await denied(anon.rpc('admin_accounts'));await denied(anon.rpc('submit_lions_choice',{p_registration_id:randomUUID()}));
  assert.deepEqual(await rpc(anon,'public_events'),[]);ok('Anonymous table/contact enumeration and staff RPCs denied; unpublished public projection empty');
  stage='temporary event';
  const ev=await admin.from('events').insert({slug:`phase1b-${randomUUID()}`,name:'Phase 1B temporary test',event_year:2026}).select('id').single();assert.equal(ev.error,null);event=ev.data!.id;
  const pa=await admin.from('participants').insert({name:'Phase 1B private sentinel',email:'private-sentinel@example.invalid',phone:'5551234567',address:'Private sentinel',zip:'00000'}).select('id').single();assert.equal(pa.error,null);participant=pa.data!.id;
  const ca=await admin.from('cars').insert({participant_id:participant,year:1955,make:'Test',model:'Snapshot'}).select('id').single();assert.equal(ca.error,null);car=ca.data!.id;
  const opened=await admin.from('events').update({judging_open:true}).eq('id',event!);assert.equal(opened.error,null);
  const reg=await rpc(admin,'admin_register_car',{p_event_id:event,p_car_id:car});const registration=reg.id;
  stage='judge boundaries';assert.equal((await judge.client.from('participants').select('*')).data?.length,0);assert.equal((await judge.client.from('cars').select('*')).data?.length,0);
  const found=await rpc(judge.client,'judge_registrations',{p_car_number:'1'});assert.equal(found.length,1);assert.ok(!JSON.stringify(found).includes('sentinel'));assert.ok(!('participant_id' in found[0]));
  assert.equal((await rpc(judge.client,'judge_event')).length,1);
  for(const [name,args] of [['admin_accounts',{}],['admin_set_account',{p_user_id:judge.id,p_role:'admin',p_active:true,p_name:'Spoof'}],['admin_quick_edit',{p_registration_id:registration,p_values:{},p_expected:{},p_request_id:randomUUID()}]] as const) await denied(judge.client.rpc(name,args));
  await denied(judge.client.from('profiles').update({app_role:'admin'}).eq('id',judge.id));
  await judge.client.auth.updateUser({data:{app_role:'admin',role:'admin'}});assert.equal(await rpc(judge.client,'current_app_role'),'judge');
  assert.equal((await judge.client.from('event_registrations').update({payment_status:'Paid'}).eq('id',registration).select()).data?.length,0);
  await denied(judge.client.from('scores').insert({event_registration_id:registration,total_score:180}));
  await denied(judge.client.from('score_history').update({judge_name_snapshot:'Spoof'}).eq('id',randomUUID()));await denied(judge.client.from('score_history').delete().eq('id',randomUUID()));
  ok('Judge projections exclude contacts; metadata/role escalation, payment, user management, Quick Edit and direct history/totals denied');
  stage='voting';await Promise.all(Array.from({length:10},()=>rpc(judge.client,'submit_lions_choice',{p_registration_id:registration})));
  assert.deepEqual(await rpc(judge.client,'judge_score',{p_registration_id:registration}),[]);
  assert.equal((await admin.from('event_registrations').select('lions_choice_votes').eq('id',registration).single()).data?.lions_choice_votes,10);ok('10 concurrent Lions Choice votes without a score row');
  stage='section scoring';
  const submit=(values:unknown,section='body_paint',request=randomUUID())=>rpc(judge.client,'submit_section',{p_registration_id:registration,p_section:section,p_values:values,p_request_id:request});
  await denied(judge.client.rpc('submit_section',{p_registration_id:registration,p_section:'body_paint',p_values:{coverage:0},p_request_id:randomUUID(),p_user_id:other.id}));
  for(const values of [{coverage:1.5},{coverage:-1},{coverage:16},{coverage:true},{user_id:other.id},{total_score:180}]) await assert.rejects(submit(values));
  const request=randomUUID();const first=await submit({coverage:'0',quality:''},'body_paint',request);assert.equal(await submit({coverage:'0',quality:''},'body_paint',request),first);
  await submit({coverage:'0',quality:''});
  let score=(await rpc(judge.client,'judge_score',{p_registration_id:registration}))[0];assert.equal(score.coverage,0);assert.equal(score.quality,null);assert.equal(score.progress_percentage,5.88);assert.equal(score.total_score,null);
  assert.equal((await rpc(judge.client,'judge_history',{p_registration_id:registration})).length,2);
  const saved=(await admin.from('score_history').select('user_id,judge_name_snapshot').eq('id',first).single()).data!;assert.equal(saved.user_id,judge.id);assert.equal(saved.judge_name_snapshot,'Phase 1B Judge');
  await Promise.all(Object.entries(SECTIONS).map(([section,values])=>submit(values,section)));
  score=(await rpc(judge.client,'judge_score',{p_registration_id:registration}))[0];assert.equal(score.total_score,180);assert.equal(score.progress_percentage,100);
  ok('Six concurrent sections atomic; strict input/zero/blank, trusted actor, retries and repeated history pass');
  stage='Quick Edit';const quickArgs={p_registration_id:registration,p_values:{coverage:'0'},p_expected:MAXIMA,p_request_id:randomUUID()};
  const quick=await rpc(admin,'admin_quick_edit',quickArgs);assert.equal(await rpc(admin,'admin_quick_edit',quickArgs),quick);
  const quickHistory=(await admin.from('score_history').select('*').eq('id',quick).single()).data!;assert.equal(quickHistory.action_type,'admin_quick_edit');assert.equal(quickHistory.section,null);assert.equal(quickHistory.user_id,login.data.user!.id);
  score=(await rpc(judge.client,'judge_score',{p_registration_id:registration}))[0];assert.equal(score.coverage,0);assert.equal(score.quality,null);assert.equal(score.progress_percentage,5.88);
  assert.equal((await admin.from('event_registrations').select('status').eq('id',registration).single()).data?.status,'Judged');
  await denied(admin.rpc('admin_quick_edit',{...quickArgs,p_request_id:randomUUID()}));ok('Admin Quick Edit atomic audit, missing NULL, valid zero, progress, no downgrade, stale-edit refusal');
  stage='public projection';await admin.from('events').update({public_visible:true,results_public:true}).eq('id',event!);
  const publicRows=await rpc(anon,'public_results',{p_event_slug:ev.data!.id? (await admin.from('events').select('slug').eq('id',event!).single()).data!.slug:''});assert.equal(publicRows.length,1);
  assert.deepEqual(Object.keys(publicRows[0]).sort(),['car_number','vehicle_year','vehicle_make','vehicle_model','classification','total_score','overall_paint','overall_interior','overall_engine'].sort());
  await admin.from('cars').update({year:2001,make:'Changed'}).eq('id',car!);
  assert.equal((await rpc(judge.client,'judge_registrations'))[0].vehicle_year,1955);ok('Explicit public field allowlist and immutable event vehicle snapshots');
  stage='roles/deactivation';await rpc(admin,'admin_set_account',{p_user_id:other.id,p_role:'judge',p_active:true,p_name:'Phase 1B Admin'});assert.equal(await rpc(other.client,'current_app_role'),'judge');await denied(other.client.rpc('admin_accounts'));
  await rpc(admin,'admin_set_account',{p_user_id:judge.id,p_role:'judge',p_active:false,p_name:'Phase 1B Judge'});assert.equal(await rpc(judge.client,'current_app_role'),null);await denied(judge.client.rpc('judge_event'));await assert.rejects(submit({coverage:0}));
  const deleted=await privileged.deleteUser(judge.id);assert.equal(deleted.error,null);ids.splice(ids.indexOf(judge.id),1);
  const retained=(await admin.from('score_history').select('user_id,judge_name_snapshot').eq('id',first).single()).data!;assert.equal(retained.user_id,null);assert.equal(retained.judge_name_snapshot,'Phase 1B Judge');
  ok('Role change/deactivation block existing JWTs; Auth deletion retains attribution');
  stage='password boundary';const accountRows=await rpc(admin,'admin_accounts');assert.ok(accountRows.every((r:Record<string,unknown>)=>Object.keys(r).sort().join(',')==='app_role,display_name,email,id,is_active'));
  const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND (column_name ILIKE '%password%' OR column_name ILIKE '%secret%')")).rows;assert.equal(columns.length,0);ok('Account response has no password/secret fields; application schema stores none');
 }catch(error){console.error(`Live test failed at ${stage}: ${error instanceof Error&&/^(RPC |Test sign-in failed|Account could not|Account was not|Role assignment failed)/.test(error.message)?error.message:'assertion or request failed (sensitive values suppressed)'}`);process.exitCode=1;
 }finally{
  for(const id of ids){const deleted=await privileged.deleteUser(id);if(deleted.error) throw new Error('Temporary Auth cleanup failed');}
  // Owner-only staging cleanup. Lock history, disable only its append-only trigger inside
  // this transaction, and delete solely rows linked to our fresh nonlegacy test event.
  await db.exec('BEGIN');
  try{
   if(event){
    const safe=(await db.query('SELECT legacy_source_key FROM public.events WHERE id=$1',[event])).rows[0];assert.equal(safe?.legacy_source_key,null);
    await db.exec('ALTER TABLE public.score_history DISABLE TRIGGER score_history_immutable');
    await db.query('DELETE FROM public.score_history WHERE score_id IN (SELECT s.id FROM public.scores s JOIN public.event_registrations r ON r.id=s.event_registration_id WHERE r.event_id=$1) AND legacy_update_id IS NULL',[event]);
    await db.exec('ALTER TABLE public.score_history ENABLE TRIGGER score_history_immutable');
    await db.query('DELETE FROM public.scores WHERE event_registration_id IN (SELECT id FROM public.event_registrations WHERE event_id=$1)',[event]);
    await db.query('DELETE FROM public.event_registrations WHERE event_id=$1',[event]);await db.query('DELETE FROM public.events WHERE id=$1',[event]);
   }
   if(car)await db.query('DELETE FROM public.cars WHERE id=$1 AND legacy_car_id IS NULL',[car]);if(participant)await db.query('DELETE FROM public.participants WHERE id=$1 AND legacy_participant_id IS NULL',[participant]);
   await db.exec('COMMIT');
  }catch{await db.exec('ROLLBACK');throw new Error('Temporary database cleanup failed');}
  const report=await regression(db);await db.close();
  if(!process.exitCode){await writeFile('docs/car-show-phase1b/live-test-report.json',JSON.stringify({passed:true,checks,regression:report,temporary_data_removed:true},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,temporary_data_removed:true},null,2));}
 }
}
main().catch(()=>{console.error('Live test infrastructure or cleanup failed; inspect safely without logging secrets.');process.exitCode=1;});
