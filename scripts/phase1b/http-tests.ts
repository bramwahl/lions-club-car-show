import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { provisionAccount } from '../../src/auth/accounts';
async function main(){
 const base=process.env.TEST_APP_URL??'http://127.0.0.1:3000';
 if(new URL(base).hostname!=='127.0.0.1')throw new Error('Tests require the local application');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
 const privileged=createClient(url,(process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}}).auth.admin;
 const jar=new Map<string,string>();
 const admin=createServerClient(url,key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>jar.set(v.name,v.value))}});
 const login=await admin.auth.signInWithPassword({email:process.env.BOOTSTRAP_ADMIN_EMAIL!,password:process.env.BOOTSTRAP_ADMIN_PASSWORD!});assert.equal(login.error,null);
 const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
 const judgeJar=new Map<string,string>(),judge=createServerClient(url,key,{cookies:{getAll:()=>[...judgeJar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>judgeJar.set(v.name,v.value))}});
 let id:string|undefined;const checks:string[]=[];
 try{
  const email=`phase1b-http-${randomUUID()}@example.invalid`,password=`T1!${randomUUID()}`;
  const created=await provisionAccount(privileged,{email,password,name:'Phase 1B HTTP Judge',role:'judge'},async userId=>{
    const {error}=await admin.rpc('admin_set_account',{p_user_id:userId,p_role:'judge',p_active:true,p_name:'Phase 1B HTTP Judge'});assert.equal(error,null);
  });id=created.id;
  assert.equal((await judge.auth.signInWithPassword({email,password})).error,null);
  const judgeCookie=()=>[...judgeJar].map(([k,v])=>`${k}=${v}`).join('; ');
  assert.equal((await fetch(base)).status,200);
  for(const route of ['/staff','/judge','/admin','/admin/users']){
    const res=await fetch(base+route,{redirect:'manual'});assert.equal(res.status,307);assert.equal(res.headers.get('location'),'/sign-in');
  }checks.push('Public home succeeds; anonymous staff/Judge/Admin routes redirect');
  for(const route of ['/staff','/judge']){const res=await fetch(base+route,{headers:{Cookie:judgeCookie()},redirect:'manual'});assert.equal(res.status,200);const html=await res.text();assert.ok(!html.includes('href="/admin'));}
  for(const route of ['/admin','/admin/users']){const res=await fetch(base+route,{headers:{Cookie:judgeCookie()},redirect:'manual'});assert.equal(res.status,307);assert.equal(res.headers.get('location'),'/judge');}
  checks.push('Judge pages succeed with Judge navigation; direct Admin URLs denied');
  const res=await fetch(base+'/admin/users',{headers:{Cookie:cookie()}});assert.equal(res.status,200);const html=await res.text();assert.ok(html.includes('Create an account'));assert.ok(!html.includes(process.env.BOOTSTRAP_ADMIN_PASSWORD!));assert.ok(!html.includes(process.env.SUPABASE_SECRET_KEY!));
  checks.push('Admin account page succeeds without returning password or privileged key');
  const manifest=JSON.parse(await readFile('.next/server/server-reference-manifest.json','utf8'));
  for(const [action,value] of Object.entries(manifest.node) as [string,{exportedName:string}][]){
    if(!['createAccount','updateAccount'].includes(value.exportedName))continue;
    for(const [caller,cookies] of [['anonymous',''],['judge',judgeCookie()]]){
      const response=await fetch(base+'/admin/users',{method:'POST',headers:{Cookie:cookies,Origin:base,'Next-Action':action,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify([{message:''},null]),redirect:'manual'});
      assert.ok([200,303].includes(response.status));assert.ok(response.headers.get('x-action-redirect')?.startsWith(caller==='judge'?'/judge':'/sign-in'));
    }
  }checks.push('Forged account create/update Server Action requests reject anonymous and Judge sessions');
  await admin.rpc('admin_set_account',{p_user_id:id,p_role:'judge',p_active:false,p_name:'Phase 1B HTTP Judge'});
  const inactive=await fetch(base+'/judge',{headers:{Cookie:judgeCookie()},redirect:'manual'});assert.equal(inactive.status,307);assert.equal(inactive.headers.get('location'),'/sign-in?access=inactive');checks.push('Deactivated Judge existing session blocked at server route');
  async function scan(dir:string):Promise<void>{for(const entry of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${entry.name}`;if(entry.isDirectory())await scan(path);else if(/\.(js|html|json)$/.test(path)){const contents=await readFile(path,'utf8');for(const secret of [process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_DB_URL,process.env.BOOTSTRAP_ADMIN_PASSWORD].filter(Boolean) as string[])assert.ok(!contents.includes(secret),'Client artifact must contain no privileged credential');}}}
  await scan('.next/static');checks.push('Built client artifacts contain no privileged key, DB URI or bootstrap password');
  await writeFile('docs/car-show-phase1b/http-test-report.json',JSON.stringify({passed:true,checks},null,2)+'\n');console.log(JSON.stringify({passed:true,checks},null,2));
 }finally{if(id){const result=await privileged.deleteUser(id);assert.equal(result.error,null);}}
}
main().catch(error=>{console.error('HTTP authorization tests failed; '+String(error?.stack).split('\n').filter(line=>line.includes('http-tests.ts')).join(' '));process.exitCode=1;});
