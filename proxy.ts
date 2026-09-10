import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicConfig } from './src/supabase/public-config';
export async function proxy(request: NextRequest) {
  let response=NextResponse.next({request}); const {url,key}=publicConfig();
  const client=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:values=>{
    values.forEach(({name,value})=>request.cookies.set(name,value));
    response=NextResponse.next({request});
    values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
  }}});
  await client.auth.getClaims(); // Refresh only. Pages/actions verify getUser and live profile.
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config={matcher:['/sign-in','/staff/:path*','/judge/:path*','/admin/:path*']};
