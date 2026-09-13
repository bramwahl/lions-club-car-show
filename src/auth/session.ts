import 'server-only';
import { safeReturn } from '../workflows/types';
import { redirect } from 'next/navigation';
import { sessionClient } from '../supabase/server';
import type { AppRole } from './accounts';
export async function requireStaff(admin=false,returnTo?:string) {
  const client=await sessionClient();
  let result=await client.auth.getUser();
  const temporary=(error:typeof result.error)=>!!error&&(error.name==='AuthRetryableFetchError'||(error.status??0)>=500);
  if(temporary(result.error))result=await client.auth.getUser();
  if(temporary(result.error))throw new Error('Sign-in verification is temporarily unavailable. Please retry.');
  const {data:{user},error}=result;
  if(error||!user) redirect(returnTo?`/sign-in?next=${encodeURIComponent(safeReturn(returnTo))}`:'/sign-in');
  const {data:profile,error:profileError}=await client.from('profiles').select('display_name,app_role,is_active').eq('id',user.id).single();
  if(profileError&&profileError.code!=='PGRST116'){console.error('Supabase profile read failed',{code:profileError.code});throw new Error('Account access could not be checked. Please retry.');}
  if(!profile?.is_active||!['admin','judge'].includes(profile.app_role)) redirect('/sign-in?access=inactive');
  if(admin&&profile.app_role!=='admin') redirect('/judge');
  return {client,user,profile:profile as {display_name:string;app_role:AppRole;is_active:boolean}};
}
