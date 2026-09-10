'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '../../src/auth/session';
import type { FormState } from '../actions';
import { STATUSES } from '../../src/workflows/types';
const text=(form:FormData,key:string,max=255)=>{const value=String(form.get(key)??'');if(value.length>max)throw new Error('Field is too long');return value;};
const id=(form:FormData,key:string)=>{const value=text(form,key,36);if(!/^[0-9a-f-]{36}$/i.test(value))throw new Error('Invalid selection');return value;};
const fail={message:'Could not save. Check the fields and try again.'};
export async function chooseEvent(form:FormData){const {client}=await requireStaff(true);const value=id(form,'event');const {data}=await client.from('events').select('id').eq('id',value).single();if(!data)throw new Error('Event not found');(await cookies()).set('car-show-event',value,{httpOnly:true,sameSite:'lax',path:'/',secure:process.env.NODE_ENV==='production'&&process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://')===true});redirect('/admin');}
export async function saveEvent(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);let created:string|undefined;
 try{const name=text(form,'name').trim(),year=Number(text(form,'year',4)),date=text(form,'date',10)||null;if(!name||!Number.isInteger(year)||year<1901||year>2155||date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number(date.slice(0,4))!==year))return {message:'Enter an event name, valid year and a date in that year.'};
 if(form.get('id')){const eventId=id(form,'id');const {data:existing}=await client.from('events').select('legacy_source_key').eq('id',eventId).single();if(!existing||existing.legacy_source_key)return {message:'Historical event metadata is read-only.'};const result=await client.from('events').update({name,event_year:year,event_date:date}).eq('id',eventId);if(result.error)return fail;created=eventId;}
 else{const result=await client.from('events').insert({name,event_year:year,event_date:date,slug:`show-${year}-${crypto.randomUUID().slice(0,8)}`}).select('id').single();if(result.error)return fail;created=result.data.id;}
 }catch{return fail;}revalidatePath('/admin','layout');if(created){(await cookies()).set('car-show-event',created,{httpOnly:true,sameSite:'lax',path:'/'});redirect('/admin');}return fail;}
export async function openJudging(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);try{const {error}=await client.rpc('admin_open_judging',{p_event:id(form,'event'),p_open:form.get('open')==='true'});if(error)return {message:'Could not change judging. Historical events remain closed.'};}catch{return fail;}revalidatePath('/admin','layout');revalidatePath('/judge','layout');return {message:'Judging access updated.',success:true};}
export async function saveParticipant(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);let target='';try{
 const values={name:text(form,'name').trim(),email:text(form,'email').trim(),phone:text(form,'phone',50),address:text(form,'address',2000),city:text(form,'city'),state:text(form,'state',100),zip:text(form,'zip',20)};
 if(!values.name||values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))return {message:'Enter a name and a valid email address.'};
 if(form.get('id')){target=id(form,'id');const {error}=await client.from('participants').update(values).eq('id',target);if(error)return fail;}
 else{if(!values.email)return {message:'Email is required when adding a participant.'};const {data,error}=await client.rpc('admin_add_participant',{p_values:values});if(error)return {message:error.code==='23505'?'That email already exists. Search for the participant and add a car to their record.':'Participant could not be added.'};target=data;}
 }catch{return fail;}revalidatePath('/admin','layout');redirect(`/admin/participants/${target}`);}
export async function saveCar(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);let participant='';try{participant=id(form,'participant');const yearText=text(form,'year',4),year=Number(yearText);const values={year,make:text(form,'make').trim(),model:text(form,'model').trim(),notes:text(form,'notes',5000)};if(!/^\d{4}$/.test(yearText)||year<1900||year>2155||!values.make||!values.model)return {message:'Enter a four-digit year, make and model.'};
 const result=form.get('car')?await client.from('cars').update(values).eq('id',id(form,'car')).eq('participant_id',participant):await client.from('cars').insert({...values,participant_id:participant});if(result.error)return fail;
 }catch{return fail;}revalidatePath('/admin','layout');return {message:'Vehicle saved. Existing event snapshots are unchanged.',success:true};}
export async function registerCars(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);try{const cars=form.getAll('cars').map(String);if(!cars.length||cars.some(c=>! /^[0-9a-f-]{36}$/i.test(c)))return {message:'Select at least one vehicle.'};const {error}=await client.rpc('admin_preregister',{p_event:id(form,'event'),p_participant:id(form,'participant'),p_cars:cars,p_payment:text(form,'payment',10)||null});if(error)return {message:'Could not register those cars. Check the selected event and participant.'};}catch{return fail;}revalidatePath('/admin','layout');return {message:form.get('intent')==='payment'?'Payment saved for this event.':'Car pre-registered. Use Check in when it arrives to assign its number and print the sheet.',success:true};}
export async function updateRegistration(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);try{const registration=id(form,'id');const {data}=await client.from('event_registrations').select('event_id,car_number').eq('id',registration).single();if(!data)return fail;const {data:event}=await client.from('events').select('legacy_source_key').eq('id',data.event_id).single();if(!event||event.legacy_source_key)return {message:'Historical registrations are read-only.'};const status=text(form,'status',20),payment=text(form,'payment',10);if(!data.car_number&&['Checked-in','Judged'].includes(status))return {message:'Use Check in / print car sheet to assign this car its arrival number.'};if(!STATUSES.includes(status as typeof STATUSES[number])||!['Paid','Unpaid'].includes(payment))return fail;const {error}=await client.from('event_registrations').update({status,payment_status:payment}).eq('id',registration);if(error)return fail;}catch{return fail;}revalidatePath('/admin','layout');return {message:'Registration updated.',success:true};}
export async function checkIn(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);try{const rows=form.getAll('registrations').map(String);if(!rows.length||rows.some(r=>! /^[0-9a-f-]{36}$/i.test(r)))return {message:'Select at least one registration.'};const {data,error}=await client.rpc('admin_check_in',{p_event:id(form,'event'),p_registrations:rows});if(error)return {message:'Check-in failed. Historical registrations cannot be changed.'};revalidatePath('/admin','layout');return {message:`Checked in ${data} cars. Judged cars kept their status.`,success:true};}catch{return fail;}}

export async function arriveCar(_state:FormState,form:FormData):Promise<FormState>{
 const {client}=await requireStaff(true);let registration:string;
 try{const result=await client.rpc('admin_arrival',{p_event:id(form,'event'),p_participant:id(form,'participant'),p_car:id(form,'car'),p_payment:text(form,'payment',10)});if(result.error)return {message:'Check-in failed. Confirm the selected event, car and payment status.'};registration=result.data;}
 catch{return fail;}
 revalidatePath('/admin','layout');redirect(`/admin/registrations/${registration}/print`);
}

export async function submitVehicleRegistration(state:FormState,form:FormData):Promise<FormState>{
 await requireStaff(true);
 if(form.get('operation')==='check-in')return arriveCar(state,form);
 if(form.get('operation')==='pre-register')return registerCars(state,form);
 return {message:'Choose Check in or Pre-register to continue.'};
}
