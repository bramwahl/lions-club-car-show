'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '../../../src/auth/session';
import { accountInput, provisionAccount } from '../../../src/auth/accounts';
import { privilegedAuth } from '../../../src/supabase/admin';
import type { FormState } from '../../actions';
export async function createAccount(_previous:FormState,form:FormData):Promise<FormState> {
  const {client}=await requireStaff(true);
  let input;try {input=accountInput(form);} catch {return {message:'Use a valid email, name, role and a password of at least 12 characters (maximum 72 bytes).'};}
  try {
    await provisionAccount(privilegedAuth(),input,async id=>{
      const {error}=await client.rpc('admin_set_account',{p_user_id:id,p_role:input.role,p_active:true,p_name:input.name});
      if(error) throw new Error('Role assignment failed');
    });
  } catch(error) {return {message:error instanceof Error ? error.message : 'Account could not be created.'};}
  revalidatePath('/admin/users');return {message:'Account created. The user can sign in with the password you supplied. No email was sent.',success:true};
}
export async function updateAccount(_previous:FormState,form:FormData):Promise<FormState> {
  const {client}=await requireStaff(true);
  const id=String(form.get('id')??'');const name=String(form.get('name')??'').trim();const role=form.get('role');
  if(!/^[0-9a-f-]{36}$/i.test(id)||name.length<2||name.length>80||(role!=='admin'&&role!=='judge')) return {message:'Invalid account fields.'};
  const {error}=await client.rpc('admin_set_account',{p_user_id:id,p_role:role,p_active:form.get('active')==='on',p_name:name});
  if(error) return {message:error.code==='23514'?'Keep at least one active Admin.':'Account could not be updated.'};
  revalidatePath('/admin/users');return {message:'Account access updated.',success:true};
}
