import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { publicConfig } from '../supabase/public-config';
export async function portal(action:string,data:Record<string,unknown>={}) {
 const secret=process.env.REGISTRATION_PORTAL_SECRET;
 if(!secret || secret.length<32) return {error:'Online registration is not open yet. Please visit the check-in table.'};
 const h=await headers();
 // A global database limit also applies; no client-provided IP can bypass it.
 const ip=h.get('x-vercel-forwarded-for')??h.get('x-forwarded-for')??'local';
 const clientKey=createHmac('sha256',secret).update(ip.slice(0,256)).digest('hex');
 const {url,key}=publicConfig();
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:result,error}=await client.rpc('registration_portal',{p_secret:secret,p_client:clientKey,p_action:action,p_data:data});
 if(error)return {error:'Online registration is not available right now. Please visit the check-in table.'};
 return result;
}
