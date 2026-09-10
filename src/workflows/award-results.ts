import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { awardsFor,registrations,rpc } from './data';
import { statistics,type EventRow } from './types';
import { calculateAwards,type AwardInput } from '../domain/awards';
import { awardTies,repeatedAwardKeys } from './award-review';
export async function choiceConfirmation(client:SupabaseClient,event:string){const {data,error}=await client.rpc('admin_lions_choice',{p_event:event});if(error){if(error.code==='PGRST202'||error.code==='42883')return {available:false,winner:null};throw new Error('Lions Choice confirmation could not be loaded');}return {available:true,winner:data as {registration_id:string;confirmed_name:string;confirmed_at:string}|null};}
export async function awardResults(client:SupabaseClient,event:string){
 const [inputs,rows,events,choice]=await Promise.all([rpc<AwardInput[]>(client,'admin_award_inputs',{p_event:event}),registrations(client,event),rpc<EventRow[]>(client,'admin_directory',{p_kind:'events'}),choiceConfirmation(client,event)]);
 const awards=calculateAwards(inputs);const ties=awardTies(inputs,awards);
 const selected=events.find(e=>e.id===event);const previous=events.filter(e=>e.legacy_source_key==='qkby:2025'&&e.event_year===(selected?.event_year??0)-1);
 // Only validated historical events are eligible until an explicit real/test event model exists.
 const past=(await Promise.all(previous.map(e=>awardsFor(client,e.id)))).flat();
 return {awards,ties,stats:statistics(rows),registrationIds:Object.fromEntries(rows.map(r=>[r.car_id,r.id])),repeatKeys:repeatedAwardKeys([...awards,...ties.flatMap(tie=>tie.cars.map(car=>({car_id:car.car_id,award:tie.award})))],past),historyAvailable:previous.length>0,confirmationAvailable:choice.available,confirmedId:choice.winner?.registration_id??null,lions:rows.filter(r=>r.lions_choice_votes>0).sort((a,b)=>b.lions_choice_votes-a.lions_choice_votes).map(r=>({id:r.id,eligible:!!r.car_number&&['Checked-in','Judged'].includes(r.status??''),number:r.car_number,vehicle:`${r.vehicle_year} ${r.vehicle_make} ${r.vehicle_model}`,votes:r.lions_choice_votes})),updated:new Date().toISOString()};
}
