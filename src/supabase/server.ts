import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicConfig } from './public-config';
export async function sessionClient() {
  const jar=await cookies(); const {url,key}=publicConfig();
  return createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll:values=>{
    try {values.forEach(({name,value,options})=>jar.set(name,value,options));}
    catch { /* Server Components cannot set cookies; proxy refreshes them. */ }
  }}});
}
