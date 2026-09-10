'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '../../../src/auth/session';
import type { FormState } from '../../actions';
export async function confirmLionsChoice(_:FormState,form:FormData):Promise<FormState>{const {client}=await requireStaff(true);const event=String(form.get('event')??''),registration=String(form.get('registration')??''),expected=String(form.get('expected')??'');const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;if(!uuid.test(event)||!uuid.test(registration)||(expected&&!uuid.test(expected)))return {message:'Invalid winner selection.'};const {error}=await client.rpc('admin_confirm_lions_choice',{p_event:event,p_registration:registration,p_expected:expected||null});if(error)return {message:'Winner could not be confirmed. Refresh and try again; the local database update must be installed.'};revalidatePath('/admin/awards');return {success:true,message:'Lions Choice winner confirmed.'};}
