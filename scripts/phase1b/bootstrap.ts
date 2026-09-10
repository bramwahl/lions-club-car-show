import { createClient } from '@supabase/supabase-js';
import { connectTarget } from '../phase1a/db';
import { accountInput, provisionAccount } from '../../src/auth/accounts';
async function main(){
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Missing server Auth configuration');
const db=await connectTarget();
try{
  await db.exec('BEGIN');await db.query('SELECT pg_advisory_xact_lock(20250907,2)');
  const count=(await db.query("SELECT count(*)::integer AS n FROM public.profiles WHERE app_role='admin' AND is_active")).rows[0].n;
  if(count!==0){console.log('Active Admin already exists; bootstrap is a no-op.');await db.exec('ROLLBACK');}
  else {
    const form=new FormData();form.set('email',process.env.BOOTSTRAP_ADMIN_EMAIL??'');form.set('password',process.env.BOOTSTRAP_ADMIN_PASSWORD??'');form.set('name',process.env.BOOTSTRAP_ADMIN_NAME??'Administrator');form.set('role','admin');
    const input=accountInput(form);
    const api=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.admin;
    await provisionAccount(api,input,async id=>{
      await db.query("INSERT INTO public.profiles(id,display_name,app_role,is_active) VALUES ($1,$2,'admin',true)",[id,input.name]);
      await db.exec('COMMIT');
    });
    console.log('Initial Admin created and confirmed without email. Password was not returned or logged.');
  }
}catch{await db.exec('ROLLBACK');console.error('Admin bootstrap failed; no credentials logged.');process.exitCode=1;}finally{await db.close();}

}
main().catch(()=>{console.error('Bootstrap connection failed; no credentials logged');process.exitCode=1;});
