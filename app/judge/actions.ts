'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '../../src/auth/session';
import { FIELDS,SECTIONS,validateInputs,type Section } from '../../src/domain/scoring';
import type { FormState } from '../actions';
const uuid=(value:FormDataEntryValue|null)=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value)?value:null;
export async function submitJudging(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff();const registration=uuid(form.get('registration')),request=uuid(form.get('request'));const section=String(form.get('section')) as Section;if(!registration||!request||!Object.hasOwn(SECTIONS,section))return {message:'Invalid judging request.'};let values;try{values=validateInputs(Object.fromEntries(Object.keys(SECTIONS[section]).map(k=>[k,form.get(k)])),section);if(Object.values(values).some(v=>v===null))return {message:'Complete every field in this section. Zero is a valid score.'};}catch{return {message:'Scores must be whole numbers within the displayed maximum.'};}const {error}=await client.rpc('submit_section',{p_registration_id:registration,p_section:section,p_values:values,p_request_id:request});if(error)return {message:'Section was not saved. Check that this event is open for judging and try again.'};revalidatePath(`/judge/registrations/${registration}`);revalidatePath('/admin','layout');return {message:'Section saved. History and progress updated.',success:true};}
export async function quickEdit(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);const registration=uuid(form.get('registration')),request=uuid(form.get('request'));if(!registration||!request)return {message:'Invalid score selection.'};let values,expected;try{values=validateInputs(Object.fromEntries(FIELDS.map(k=>[k,form.get(k)])));expected=JSON.parse(String(form.get('expected')));}catch{return {message:'Use whole numbers within the maximum. Leave incomplete fields blank.'};}const {error}=await client.rpc('admin_quick_edit',{p_registration_id:registration,p_values:values,p_expected:expected,p_request_id:request});if(error)return {message:error.code==='40001'?'Scores changed since this form opened. Reload before editing.':'Quick Edit failed. This event must be open for judging.'};revalidatePath('/admin','layout');revalidatePath(`/judge/registrations/${registration}`);return {message:'Quick Edit saved with administrative audit history.',success:true};}
export async function voteLionsChoice(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff();const registration=uuid(form.get('registration'));if(!registration)return {message:'Choose a registration.'};const {error}=await client.rpc('submit_lions_choice',{p_registration_id:registration});if(error)return {message:'Vote was not recorded. This event must be open for judging.'};revalidatePath('/judge','layout');revalidatePath('/admin','layout');return {message:'One Lions Choice vote recorded.',success:true};}

export async function submitSelectedSections(_state:FormState,form:FormData):Promise<FormState>{
 const {client}=await requireStaff();const registration=uuid(form.get('registration'));
 if(!registration)return {message:'Invalid registration.'};
 const selected=form.getAll('sections').map(String);
 if(selected.length<1||selected.length>6||new Set(selected).size!==selected.length)return {message:'Select at least one judging section.'};
 const submissions=[];
 try{for(const section of selected){if(!Object.hasOwn(SECTIONS,section))throw new Error('Section');const request=uuid(form.get(`request_${section}`));if(!request)throw new Error('Request');const values=validateInputs(Object.fromEntries(Object.keys(SECTIONS[section as Section]).map(field=>[field,form.get(field)])),section as Section);if(Object.values(values).some(v=>v===null))return {message:`Complete every item in ${section.replaceAll('_',' ')}. Zero is valid.`};submissions.push({section,values,request});}}
 catch{return {message:'Enter whole numbers from zero to the maximum shown for each item.'};}
 const {error}=await client.rpc('submit_sections',{p_registration_id:registration,p_submissions:submissions});
 if(error)return {message:'Nothing was saved. Confirm the event is open and all selected sections are complete, then retry.'};
 revalidatePath(`/judge/registrations/${registration}`);revalidatePath('/admin','layout');
 return {success:true,message:`Saved ${submissions.length} section${submissions.length===1?'':'s'}. Judge attribution, history and progress updated.`};
}
