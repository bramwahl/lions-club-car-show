'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '../../../src/auth/session';
import type { FormState } from '../../actions';
export async function configurePortal(_:FormState,form:FormData):Promise<FormState>{
 const {client}=await requireStaff(true);const secret=process.env.REGISTRATION_PORTAL_SECRET;
 if(!secret||secret.length<32)return {message:'Set the server-only REGISTRATION_PORTAL_SECRET before opening registration.'};
 const {error}=await client.rpc('admin_registration_portal',{p_event:form.get('event')||null,p_hash:createHash('sha256').update(secret).digest('hex')});
 if(error)return {message:'Registration could not be configured. The database migration may not be applied yet.'};
 revalidatePath('/admin/registration-requests');revalidatePath('/register');return {message:'Public registration setting saved.'};
}
export async function reviewRequest(_:FormState,form:FormData):Promise<FormState>{
 const {client}=await requireStaff(true);
 const {error}=await client.rpc('admin_review_registration',{p_request:form.get('request'),p_participant:form.get('participant')||null,p_cars:form.getAll('car').map(v=>v||null),p_dismiss:form.get('dismiss')==='yes'});
 if(error)return {message:'Unable to review this request. Check the participant and cars, or refresh if it was already reviewed.'};
 revalidatePath('/admin/registration-requests');revalidatePath('/admin/participants');revalidatePath('/admin/registrations');return {message:'Request reviewed. Continue through the participant’s normal check-in page.'};
}
