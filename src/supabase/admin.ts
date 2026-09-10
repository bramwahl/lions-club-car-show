import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicConfig } from './public-config';
// Only Auth provisioning and compensating removal. Never use for normal table/RPC access.
export function privilegedAuth() {
  const key=process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) throw new Error('Server account provisioning is not configured');
  return createClient(publicConfig().url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.admin;
}
