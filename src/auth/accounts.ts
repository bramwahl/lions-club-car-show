import type { SupabaseClient } from '@supabase/supabase-js';
export type AppRole = 'admin' | 'judge';
export type AccountInput = { email: string; password: string; name: string; role: AppRole };
export function accountInput(form: FormData): AccountInput {
  const email=String(form.get('email')??'').trim();
  const password=String(form.get('password')??'');
  const name=String(form.get('name')??'').trim();
  const role=form.get('role');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||new TextEncoder().encode(password).length>72||name.length<2||name.length>80||(role!=='admin'&&role!=='judge')) throw new Error('Use a valid email, name, role and a password of at least 12 characters (maximum 72 bytes).');
  return {email,password,name,role};
}
// Injectable API clients allow no-email and no-password-response contract tests.
// The caller MUST freshly authorize Admin before obtaining the privileged client.
export async function provisionAccount(authAdmin: SupabaseClient['auth']['admin'], input: AccountInput,
  assign: (id:string)=>Promise<void>) {
  const {data,error}=await authAdmin.createUser({email:input.email,password:input.password,email_confirm:true});
  if(error||!data.user) throw new Error('Account could not be created. Check the email and password requirements.');
  try { await assign(data.user.id); }
  catch {
    const cleanup=await authAdmin.deleteUser(data.user.id);
    if(cleanup.error) throw new Error('Role assignment failed. The new account has no application access; an administrator must remove it in Supabase.');
    throw new Error('Account was not created because role assignment failed.');
  }
  return {id:data.user.id};
}
