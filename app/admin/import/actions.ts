'use server';
import { requireStaff } from '../../../src/auth/session';
import { parseEntrantCsv } from '../../../src/workflows/csv';
import { revalidatePath } from 'next/cache';
import type { FormState } from '../../actions';
export async function importEntrants(_state:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);const event=String(form.get('event')),request=String(form.get('request'));if(!/^[0-9a-f-]{36}$/i.test(event)||!/^[0-9a-f-]{36}$/i.test(request))return {message:'Invalid import selection.'};let rows;try{rows=parseEntrantCsv(String(form.get('csv')??''));}catch(error){return {message:error instanceof Error?error.message:'Invalid CSV.'};}const {data,error}=await client.rpc('admin_import_entrants',{p_event:event,p_rows:rows,p_request:request});if(error)return {message:'Import was not saved. Check the selected event and row values. No rows from this batch were added.'};revalidatePath('/admin','layout');return {message:`Imported ${data} participants and cars as Archived / Unpaid for this event.`,success:true};}
