'use server';
import { safeReturn } from '../src/workflows/types';
import { redirect } from 'next/navigation';
import { sessionClient } from '../src/supabase/server';
export type FormState={message:string;success?:boolean};
export async function signIn(_previous:FormState,form:FormData):Promise<FormState> {
  const email=String(form.get('email')??'').trim();const password=String(form.get('password')??'');
  if(email.length>254||password.length>128||!email||!password) return {message:'Enter your email and password.'};
  const client=await sessionClient();
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error) return {message:'Sign-in failed. Check your credentials or try again later.'};
  const {data:role}=await client.rpc('current_app_role');
  if(role!=='admin'&&role!=='judge') {await client.auth.signOut();return {message:'Application access is unavailable. Contact an administrator.'};}
  redirect(safeReturn(form.get('next')));
}
export async function signOut() {
  const client=await sessionClient();await client.auth.signOut();redirect('/sign-in');
}
