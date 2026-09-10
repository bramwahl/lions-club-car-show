import 'server-only';
import { safeReturn } from '../workflows/types';
import { redirect } from 'next/navigation';
import { sessionClient } from '../supabase/server';
import type { AppRole } from './accounts';
export async function requireStaff(admin=false,returnTo?:string) {
  const client=await sessionClient();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) redirect(returnTo?`/sign-in?next=${encodeURIComponent(safeReturn(returnTo))}`:'/sign-in');
  const {data:profile,error:profileError}=await client.from('profiles').select('display_name,app_role,is_active').eq('id',user.id).single();
  if(profileError||!profile?.is_active||!['admin','judge'].includes(profile.app_role)) redirect('/sign-in?access=inactive');
  if(admin&&profile.app_role!=='admin') redirect('/judge');
  return {client,user,profile:profile as {display_name:string;app_role:AppRole;is_active:boolean}};
}
