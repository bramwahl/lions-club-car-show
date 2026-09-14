import {localLeftIds,localAwardSkips} from './local-exclusions';
import 'server-only';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventRow, Participant, Car, Registration, History } from './types';
import { calculateAwards, type AwardInput } from '../domain/awards';
export async function rpc<T>(client:SupabaseClient,name:string,args?:Record<string,unknown>):Promise<T>{const {data,error}=await client.rpc(name,args);if(error){console.error('Supabase RPC failed',{operation:name,code:error.code});throw new Error('The requested data could not be loaded. Please try again.');}return data as T;}
export async function eventContext(client:SupabaseClient){
 const events=await rpc<EventRow[]>(client,'admin_directory',{p_kind:'events'});const selected=(await cookies()).get('car-show-event')?.value;
 return {events,event:events.find(e=>e.id===selected)??events.find(e=>e.judging_open)??events[0]??null};
}
export const directory=(client:SupabaseClient)=>Promise.all([rpc<Participant[]>(client,'admin_directory',{p_kind:'participants'}),rpc<Car[]>(client,'admin_directory',{p_kind:'cars'})]);
export const registrations=(client:SupabaseClient,event:string)=>rpc<Registration[]>(client,'admin_registrations',{p_event:event});
export async function registrationDetail(client:SupabaseClient,id:string,includeHistory=true){
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const {data,error}=await client.from('event_registrations').select('event_id').eq('id',id).single();if(error||!data)notFound();
 const {events}=await eventContext(client);const event=events.find(e=>e.id===data.event_id);if(!event)notFound();
 const registration=(await registrations(client,event.id)).find(r=>r.id===id);if(!registration)notFound();
 const history:History[]=[];
 if(includeHistory&&registration.score){for(let offset=0;;offset+=500){const res=await client.from('score_history').select('*').eq('score_id',registration.score.id).order('legacy_timestamp',{ascending:false,nullsFirst:false}).order('submitted_at',{ascending:false,nullsFirst:false}).range(offset,offset+499);if(res.error)throw new Error('History could not be loaded');history.push(...res.data as History[]);if(res.data.length<500)break;}}
 return {event,registration,history};
}
export async function awardsFor(client:SupabaseClient,event:string){return calculateAwards(await localAwardInputs(client,event),await localAwardSkips(event));}

// Admin session and existing RLS only; pagination avoids truncating event history.
export async function priorRegistrations(client:SupabaseClient,eventIds:string[]){
 const rows:{event_id:string;car_id:string}[]=[];
 for(let start=0;start<eventIds.length;start+=100){for(let offset=0;;offset+=500){
  const {data,error}=await client.from('event_registrations').select('event_id,car_id').in('event_id',eventIds.slice(start,start+100)).order('id').range(offset,offset+499);
  if(error)throw new Error('Event history could not be loaded. Please try again.');
  rows.push(...data);if(data.length<500)break;
 }}return rows;
}

export async function judgingVisits(client:SupabaseClient,rows:Registration[]){
 const ids=rows.filter(r=>['Checked-in','Judged'].includes(r.status??'')&&r.score&&Number(r.score.progress_percentage)<100).map(r=>r.score!.id);
 const visits:{score_id:string;judge_name_snapshot:string|null}[]=[];
 for(let start=0;start<ids.length;start+=100)for(let offset=0;;offset+=500){
 const {data,error}=await client.from('score_history').select('score_id,judge_name_snapshot').in('score_id',ids.slice(start,start+100)).eq('action_type','section_submission').order('id').range(offset,offset+499);
 if(error)throw new Error('Missing sections check could not be loaded.');
 visits.push(...data);if(data.length<500)break;
 }return visits;
}

export async function localAwardInputs(client:SupabaseClient,event:string){
 const inputs=await rpc<AwardInput[]>(client,'admin_award_inputs',{p_event:event});
 const ids=await localLeftIds();if(!ids.length)return inputs;
 const excluded=new Set((await registrations(client,event)).filter(r=>ids.includes(r.id)).map(r=>r.car_id));
 return inputs.filter(r=>!excluded.has(r.car_id));
}
